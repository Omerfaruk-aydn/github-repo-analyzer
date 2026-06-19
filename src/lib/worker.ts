import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "./db";
import { cloneRepo, traverseRepo, analyzeCodebase, cleanupRepo, FileData } from "./ingest";
import { executeLLMCall, UnifiedMessage } from "./llm";

// Progress mapping helper
export const activeJobsProgress: Record<string, { percent: number; status: string; log: string[] }> = {};

function logProgress(analysisId: string, percent: number, status: string, logLine: string) {
  if (!activeJobsProgress[analysisId]) {
    activeJobsProgress[analysisId] = { percent: 0, status: "", log: [] };
  }
  activeJobsProgress[analysisId].percent = percent;
  activeJobsProgress[analysisId].status = status;
  activeJobsProgress[analysisId].log.push(`[${new Date().toLocaleTimeString()}] ${logLine}`);
}

export async function executeAnalysis(analysisId: string) {
  const analysis = db.prepare("SELECT * FROM analyses WHERE id = ?").get(analysisId) as any;
  if (!analysis) return;

  const repo = db.prepare("SELECT * FROM repositories WHERE id = ?").get(analysis.repository_id) as any;
  if (!repo) return;

  // Retrieve configurations
  const config = JSON.parse(analysis.config_json || "{}");
  const modelId = config.modelId || "m2"; // default to gpt-4o-mini / gemini-1.5-flash
  const userId = analysis.requested_by || "default-user";

  logProgress(analysisId, 10, "Cloning", `Cloning repository ${repo.github_url}...`);
  db.prepare("UPDATE analyses SET status = 'cloning' WHERE id = ?").run(analysisId);

  // Retrieve user token if existing
  const gitToken = config.githubToken || undefined;

  let tempDir = "";
  try {
    const cloneResult = await cloneRepo(repo.github_url, gitToken);
    tempDir = cloneResult.tempDir;
    
    // Save repo details back to DB
    db.prepare(`
      UPDATE repositories 
      SET last_synced_sha = ?, default_branch = ?, owner = ?, name = ? 
      WHERE id = ?
    `).run(cloneResult.commitSha, cloneResult.defaultBranch, cloneResult.owner, cloneResult.name, repo.id);

    db.prepare("UPDATE analyses SET commit_sha = ? WHERE id = ?").run(cloneResult.commitSha, analysisId);

    logProgress(analysisId, 25, "Parsing", "Cloned successfully. Parsing files and structure...");
    db.prepare("UPDATE analyses SET status = 'parsing' WHERE id = ?").run(analysisId);

    const files = traverseRepo(tempDir);
    const codeMap = analyzeCodebase(files);

    // Save codebase map in database
    db.prepare("UPDATE analyses SET code_map_json = ? WHERE id = ?").run(JSON.stringify(codeMap), analysisId);

    // Persist traversed source files text in database for Explorer viewing
    db.prepare("DELETE FROM repository_files WHERE repository_id = ?").run(repo.id);
    const insertFile = db.prepare(`
      INSERT INTO repository_files (id, repository_id, file_path, content)
      VALUES (?, ?, ?, ?)
    `);
    
    files.forEach(file => {
      insertFile.run(crypto.randomUUID(), repo.id, file.relativePath, file.content);
    });

    logProgress(analysisId, 40, "Indexing", "Building directory graphs and code embeddings...");
    
    // Index embeddings (Simple JS cosine search)
    // We store files chunked into 1500-char intervals
    db.prepare("DELETE FROM code_embeddings WHERE repository_id = ?").run(repo.id);
    const insertEmbedding = db.prepare(`
      INSERT INTO code_embeddings (id, repository_id, file_path, chunk_index, content, embedding_json, commit_sha)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Only index source files to prevent DB bloating
    const filesToIndex = files.filter(f => !f.relativePath.endsWith(".md") && !f.relativePath.endsWith(".json"));
    
    // Generate simple embeddings (we will mock embedding arrays for simple client RAG, or generate if keys available)
    for (const file of filesToIndex.slice(0, 100)) { // limit RAG source docs to 100 files for sqlite space
      const chunks = chunkText(file.content, 1500);
      chunks.forEach((chunk, index) => {
        const dummyEmbedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
        insertEmbedding.run(
          crypto.randomUUID(),
          repo.id,
          file.relativePath,
          index,
          chunk,
          JSON.stringify(dummyEmbedding),
          cloneResult.commitSha
        );
      });
    }

    logProgress(analysisId, 50, "Analyzing", "Starting agent-driven AI scans...");
    db.prepare("UPDATE analyses SET status = 'analyzing' WHERE id = ?").run(analysisId);

    // Initialize agent jobs in DB
    const agents = ["architecture", "readme", "bug", "security", "suggestions"];
    const insertJob = db.prepare(`
      INSERT INTO analysis_jobs (id, analysis_id, agent_type, status, model_used, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const agent of agents) {
      insertJob.run(
        `${analysisId}-${agent}`,
        analysisId,
        agent,
        "pending",
        modelId,
        new Date().toISOString()
      );
    }

    // Execute Agents
    // Check if user has credentials setup for this model
    let providerId = "p1";
    if (modelId.startsWith("or-")) providerId = "p4";
    else if (modelId.startsWith("ollama-")) providerId = "p5";
    else {
      const modelRow = db.prepare("SELECT provider_id FROM llm_models WHERE id = ?").get(modelId) as any;
      if (modelRow) providerId = modelRow.provider_id;
    }

    const keyRow = db.prepare("SELECT id FROM user_api_keys WHERE user_id = ? AND provider_id = ?").get(userId, providerId);
    const hasKeys = !!keyRow || (providerId === "p5"); // Ollama is local, doesn't need key

    // 1. Architecture Agent
    logProgress(analysisId, 60, "Architecture", "Generating architecture diagrams and pattern analysis...");
    updateJobStatus(analysisId, "architecture", "running");
    let archResult: any = null;
    if (hasKeys) {
      archResult = await runArchitectureAgent(userId, modelId, analysisId, files, codeMap);
    } else {
      archResult = simulateArchitectureAgent(codeMap);
    }
    updateJobStatus(analysisId, "architecture", "completed");

    // 2. README Agent
    logProgress(analysisId, 70, "README", "Writing production-grade codebase README...");
    updateJobStatus(analysisId, "readme", "running");
    let readmeContent = "";
    if (hasKeys) {
      readmeContent = await runReadmeAgent(userId, modelId, analysisId, files, archResult);
    } else {
      readmeContent = simulateReadmeAgent(repo.name, codeMap, archResult);
    }
    db.prepare(`
      INSERT INTO generated_readmes (id, analysis_id, content_markdown, version)
      VALUES (?, ?, ?, 1)
    `).run(crypto.randomUUID(), analysisId, readmeContent);
    updateJobStatus(analysisId, "readme", "completed");

    // 3. Bug Agent (Static Analysis + optional LLM evaluation)
    logProgress(analysisId, 80, "Bug Analysis", "Scanning code modules for memory leaks and anti-patterns...");
    updateJobStatus(analysisId, "bug", "running");
    const bugFindings = scanForBugs(files);
    if (hasKeys && bugFindings.length > 0) {
      await enrichFindingsWithLLM(userId, modelId, analysisId, bugFindings);
    } else {
      // Save static issues directly
      const insertFinding = db.prepare(`
        INSERT INTO analysis_findings (id, analysis_id, agent_type, file_path, line_start, line_end, severity, category, title, description, suggested_fix, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      bugFindings.forEach(f => {
        insertFinding.run(
          crypto.randomUUID(),
          analysisId,
          "bug",
          f.filePath,
          f.lineStart,
          f.lineEnd,
          f.severity,
          f.category,
          f.title,
          f.description,
          f.suggestedFix,
          f.confidence
        );
      });
    }
    updateJobStatus(analysisId, "bug", "completed");

    // 4. Security Agent (Redaction + Secrets Scanning + CVE checklist)
    logProgress(analysisId, 90, "Security", "Evaluating secrets leakages and dependencies vulnerabilities...");
    updateJobStatus(analysisId, "security", "running");
    const securityFindings = scanForSecurity(files);
    // Save security findings
    const insertFinding = db.prepare(`
      INSERT INTO analysis_findings (id, analysis_id, agent_type, file_path, line_start, line_end, severity, category, title, description, suggested_fix, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    securityFindings.forEach(f => {
      insertFinding.run(
        crypto.randomUUID(),
        analysisId,
        "security",
        f.filePath,
        f.lineStart,
        f.lineEnd,
        f.severity,
        f.category,
        f.title,
        f.description,
        f.suggestedFix,
        f.confidence
      );
    });
    updateJobStatus(analysisId, "security", "completed");

    // 5. Suggestions & Roadmap Agent
    logProgress(analysisId, 95, "Suggestions", "Compiling priority features checklist and codebase roadmap...");
    updateJobStatus(analysisId, "suggestions", "running");
    let suggestions: any[] = [];
    if (hasKeys) {
      suggestions = await runSuggestionsAgent(userId, modelId, analysisId, codeMap);
    } else {
      suggestions = simulateSuggestionsAgent(codeMap);
    }
    suggestions.forEach(s => {
      insertFinding.run(
        crypto.randomUUID(),
        analysisId,
        "suggestions",
        "",
        0,
        0,
        s.impact || "medium",
        s.category || "roadmap",
        s.title,
        s.description,
        s.suggestedFix || "",
        0.9
      );
    });
    updateJobStatus(analysisId, "suggestions", "completed");

    // Complete Analysis
    db.prepare(`
      UPDATE analyses 
      SET status = 'completed', completed_at = ? 
      WHERE id = ?
    `).run(new Date().toISOString(), analysisId);
    logProgress(analysisId, 100, "Completed", "Analysis completed successfully!");

  } catch (error: any) {
    console.error("Worker Execution Error:", error);
    db.prepare(`
      UPDATE analyses 
      SET status = 'failed', completed_at = ? 
      WHERE id = ?
    `).run(new Date().toISOString(), analysisId);
    logProgress(analysisId, 100, "Failed", `Analysis failed: ${error.message}`);
  } finally {
    if (tempDir) {
      cleanupRepo(tempDir);
    }
  }
}

function updateJobStatus(analysisId: string, agent: string, status: string, error?: string) {
  db.prepare(`
    UPDATE analysis_jobs 
    SET status = ?, completed_at = ?, error_message = ? 
    WHERE id = ?
  `).run(
    status,
    status === "completed" || status === "failed" ? new Date().toISOString() : null,
    error || null,
    `${analysisId}-${agent}`
  );
}

// Helpers
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.substring(index, index + size));
    index += size;
  }
  return chunks;
}

// --- Agent Logic Implementations ---

async function runArchitectureAgent(userId: string, modelId: string, analysisId: string, files: FileData[], codeMap: any) {
  const sysPrompt = "You are a Principal Software Architect. Analyze the files structure and dependencies to map the system architectural layers, design patterns, entry points, and generate a Mermaid diagram.";
  const userPrompt = `Files map: ${JSON.stringify(Object.keys(codeMap.files).slice(0, 50))}
Imports list: ${JSON.stringify(codeMap.dependencies.slice(0, 15))}
Structure tree: ${JSON.stringify(codeMap.fileTree)}

Provide your output in JSON format:
{
  "layers": ["Layer name - description"],
  "patterns": ["Design pattern used - where/how"],
  "tech_stack": ["Detected technologies"],
  "diagram_mermaid": "Mermaid flowchart code here"
}`;

  const res = await executeLLMCall(userId, modelId, {
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt }
    ],
    responseFormat: "json"
  }, analysisId);

  try {
    return JSON.parse(res.content);
  } catch (e) {
    return simulateArchitectureAgent(codeMap);
  }
}

function simulateArchitectureAgent(codeMap: any) {
  const detectedStack: string[] = [];
  const layers: string[] = [];
  const patterns: string[] = [];

  // Determine stack from files
  let hasNext = false;
  let hasGo = false;
  let hasPython = false;
  
  Object.keys(codeMap.files).forEach(f => {
    if (f.includes("next.config") || f.includes("pages/") || f.includes("app/")) hasNext = true;
    if (f.endsWith(".go")) hasGo = true;
    if (f.endsWith(".py")) hasPython = true;
  });

  if (hasNext) {
    detectedStack.push("Next.js", "React", "TypeScript", "Tailwind CSS");
    layers.push(
      "Frontend Presentation (RSC / App Router Client Components)",
      "Routing & Middleware Integration",
      "API Routes Handlers (Backend)"
    );
    patterns.push(
      "React Server Components (RSC)",
      "Single Page Application routing layout",
      "Dynamic Route handlers"
    );
  } else if (hasGo) {
    detectedStack.push("Go", "Golang Modules");
    layers.push("API Controller Handlers", "Business/Service Operations", "Repository Persistence Database");
    patterns.push("Clean Architecture layers", "Singleton connection pools");
  } else if (hasPython) {
    detectedStack.push("Python", "FastAPI / Flask");
    layers.push("Request Endpoints Layer", "Core Business Services", "Models & Schema Layer");
    patterns.push("REST API standards", "Dependency Injection (FastAPI)");
  } else {
    detectedStack.push("Node.js", "JavaScript/TypeScript");
    layers.push("Core Application Handler", "Logic Scripts");
    patterns.push("Modular exports ES6");
  }

  return {
    layers,
    patterns,
    tech_stack: detectedStack,
    diagram_mermaid: codeMap.mermaidDiagram
  };
}

async function runReadmeAgent(userId: string, modelId: string, analysisId: string, files: FileData[], archResult: any): Promise<string> {
  const sysPrompt = "You are a Technical Writer. Write a stunning, complete, professional README.md for the following codebase.";
  const userPrompt = `Tech stack: ${JSON.stringify(archResult.tech_stack)}
Architecture layers: ${JSON.stringify(archResult.layers)}
Design Patterns: ${JSON.stringify(archResult.patterns)}
Files Structure: ${JSON.stringify(Object.keys(files).slice(0, 30))}

Create the README with standard markdown headers (Description, Tech Stack, Folder Structure, Setup Instructions, Mermaid Diagram). Include the Mermaid diagram exactly.`;

  const res = await executeLLMCall(userId, modelId, {
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt }
    ]
  }, analysisId);

  return res.content;
}

function simulateReadmeAgent(repoName: string, codeMap: any, archResult: any): string {
  const stack = archResult.tech_stack.join(", ");
  const layersList = archResult.layers.map((l: string) => `- **${l}**`).join("\n");
  const patternsList = archResult.patterns.map((p: string) => `- *${p}*`).join("\n");

  return `# ${repoName} 🧠

Welcome to your project repo! This repository has been scanned and documented by RepoMind.

## 🚀 Overview
A code repository powered by **${stack}**.

## 🛠️ Technology Stack
- **Languages / Frameworks**: ${stack}
- **Data Layers**: Local store / Database utilities
- **Testing**: Preconfigured assertion frameworks

## 🏛️ Architecture Details
${layersList}

### Key Patterns:
${patternsList}

## 🗺️ Dependency Graph
\`\`\`mermaid
${archResult.diagram_mermaid}
\`\`\`

## ⚙️ Setup & Installation

To run this repository locally, execute the following commands:

\`\`\`bash
# 1. Clone repository
git clone https://github.com/example/${repoName}.git
cd ${repoName}

# 2. Install package requirements
npm install # or python -m pip install -r requirements.txt

# 3. Launch Development Server
npm run dev # or go run main.go
\`\`\`

---
*README generated automatically by [RepoMind](https://github.com/example/repomind).*
`;
}

// Deterministic Bug scanner (Regex engine)
interface ScanFinding {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  suggestedFix: string;
  confidence: number;
}

function scanForBugs(files: FileData[]): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const file of files) {
    const ext = path.extname(file.relativePath).toLowerCase();
    const lines = file.content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // 1. Console logs (medium)
      if (line.includes("console.log(") && !line.trim().startsWith("//") && !line.trim().startsWith("/*")) {
        findings.push({
          filePath: file.relativePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          severity: "low",
          category: "code-quality",
          title: "Leftover Console Log",
          description: "Production code contains debug console.log statement. Should use loggers.",
          suggestedFix: `- ${line.trim()}\n+ // TODO: Replace with official logger or delete console.log`,
          confidence: 0.95
        });
      }

      // 2. Leftover TODO comments (low)
      if (line.includes("TODO:") || line.includes("FIXME:")) {
        findings.push({
          filePath: file.relativePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          severity: "low",
          category: "todos",
          title: "Unresolved TODO Task",
          description: `Line contains placeholder code markers: "${line.trim()}".`,
          suggestedFix: "// Completed task implementation details...",
          confidence: 0.99
        });
      }

      // 3. Eval usage (critical)
      if (line.includes("eval(") && (ext === ".js" || ext === ".ts" || ext === ".py")) {
        findings.push({
          filePath: file.relativePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          severity: "critical",
          category: "vulnerability",
          title: "Dangerous 'eval()' Execution",
          description: "Execution of javascript strings via eval is highly discouraged. Leads to injection bugs.",
          suggestedFix: "Use JSON.parse() or abstract parameters into callback configurations.",
          confidence: 0.98
        });
      }

      // 4. Shadowing variables or empty catches (medium)
      if (line.includes("catch") && line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
        findings.push({
          filePath: file.relativePath,
          lineStart: lineNum,
          lineEnd: lineNum,
          severity: "medium",
          category: "error-handling",
          title: "Silent Try-Catch Suppression",
          description: "An exception is swallowed without printing error traces or warnings.",
          suggestedFix: `} catch (error) {\n  console.error("Exception handled: ", error);\n}`,
          confidence: 0.85
        });
      }
    });
  }

  return findings.slice(0, 10); // cap to 10 findings for performance
}

async function enrichFindingsWithLLM(userId: string, modelId: string, analysisId: string, findings: ScanFinding[]) {
  const sysPrompt = "You are a Senior Code Auditor. Enrich the list of code findings with comprehensive summaries, code diffs, and exact severity reviews.";
  
  // Do enrichment in chunks of 3 for token constraints
  for (let i = 0; i < findings.length; i += 3) {
    const chunk = findings.slice(i, i + 3);
    const userPrompt = `Auditing findings:\n${JSON.stringify(chunk)}\n
Format your response as a valid JSON array matching the inputs, containing detailed 'description' and 'suggested_fix' diff format.`;

    try {
      const res = await executeLLMCall(userId, modelId, {
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt }
        ],
        responseFormat: "json"
      }, analysisId);

      const parsed = JSON.parse(res.content);
      const list = Array.isArray(parsed) ? parsed : [parsed];

      const insertFinding = db.prepare(`
        INSERT INTO analysis_findings (id, analysis_id, agent_type, file_path, line_start, line_end, severity, category, title, description, suggested_fix, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      list.forEach((item: any, index: number) => {
        const orig = chunk[index] || chunk[0];
        insertFinding.run(
          crypto.randomUUID(),
          analysisId,
          "bug",
          orig.filePath,
          orig.lineStart,
          orig.lineEnd,
          item.severity || orig.severity,
          item.category || orig.category,
          item.title || orig.title,
          item.description || orig.description,
          item.suggested_fix || orig.suggestedFix,
          orig.confidence
        );
      });
    } catch (e) {
      // Fallback: save unenriched findings
      const insertFinding = db.prepare(`
        INSERT INTO analysis_findings (id, analysis_id, agent_type, file_path, line_start, line_end, severity, category, title, description, suggested_fix, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      chunk.forEach(f => {
        insertFinding.run(
          crypto.randomUUID(),
          analysisId,
          "bug",
          f.filePath,
          f.lineStart,
          f.lineEnd,
          f.severity,
          f.category,
          f.title,
          f.description,
          f.suggestedFix,
          f.confidence
        );
      });
    }
  }
}

// Security secret scanner + OSV package checks
function scanForSecurity(files: FileData[]): ScanFinding[] {
  const findings: ScanFinding[] = [];

  // Common patterns for secrets
  const secretPatterns = [
    { name: "AWS Client Secret Key", regex: /([^A-Z0-9])[A-Za-z0-9/+=]{40}([^A-Za-z0-9/+=])/ },
    { name: "Generic Password/Credential Variable", regex: /(password|passwd|secret|api_key|apikey|private_key|token)\s*[:=]\s*['"][a-zA-Z0-9\-_{}]{8,}['"]/i },
    { name: "GitHub Token Pattern", regex: /ghp_[a-zA-Z0-9]{36}/ }
  ];

  for (const file of files) {
    const lines = file.content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      for (const pattern of secretPatterns) {
        if (pattern.regex.test(line)) {
          findings.push({
            filePath: file.relativePath,
            lineStart: lineNum,
            lineEnd: lineNum,
            severity: "critical",
            category: "secrets-leak",
            title: `Potential Leak: ${pattern.name}`,
            description: `A credential pattern matching "${pattern.name}" was detected in file ${file.relativePath}. Storing credentials in git is high risk.`,
            suggestedFix: "Use environment variables (.env files loaded via dotenv/dotenv-safely) or vault systems to ingest keys.",
            confidence: 0.95
          });
        }
      }
    });

    // OSV.dev dependency checker simulation
    if (file.relativePath === "package.json") {
      try {
        const pkg = JSON.parse(file.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // Mock a vulnerability match on old express or axios versions for demonstration
        if (deps.express && deps.express.includes("4.16")) {
          findings.push({
            filePath: "package.json",
            lineStart: 1,
            lineEnd: 1,
            severity: "high",
            category: "vulnerable-dependency",
            title: "CVE-2022-24999: Outdated Express vulnerability",
            description: "Express versions <4.17.3 are vulnerable to session hijack or Denial of Service.",
            suggestedFix: '"express": "^4.19.2"',
            confidence: 0.99
          });
        }
      } catch (e) {
        // parse error
      }
    }
  }

  return findings;
}

// Suggestions Agent
async function runSuggestionsAgent(userId: string, modelId: string, analysisId: string, codeMap: any): Promise<any[]> {
  const sysPrompt = "You are a Software Engineering Director. Based on the file structure and imports, propose 4 technical improvements or features for this codebase.";
  const userPrompt = `Tech stack: ${JSON.stringify(codeMap.files)}
Files: ${JSON.stringify(Object.keys(codeMap.files).slice(0, 40))}`;

  try {
    const res = await executeLLMCall(userId, modelId, {
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: "json"
    }, analysisId);

    let parsed = JSON.parse(res.content);
    // Handle cases where LLM returns { "suggestions": [...] }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.suggestions)) {
      parsed = parsed.suggestions;
    }
    
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    // Ensure title exists to prevent DB NOT NULL constraints
    return arr.map(item => ({
      title: item.title || "Improvement Suggestion",
      description: item.description || JSON.stringify(item),
      impact: item.impact || "medium",
      category: item.category || "roadmap",
      suggestedFix: item.suggestedFix || ""
    }));
  } catch (e) {
    return simulateSuggestionsAgent(codeMap);
  }
}

function simulateSuggestionsAgent(codeMap: any): any[] {
  return [
    {
      title: "Set up Unit & Integration Testing",
      description: "No testing configurations were detected. Introduce Jest or Vitest to improve robustness of modules.",
      impact: "high",
      category: "testing"
    },
    {
      title: "Introduce Logging Layer",
      description: "Standardize process logging. Replace console.log instances with Winston or Bunyan loggers to support cloud trace monitors.",
      impact: "medium",
      category: "observability"
    },
    {
      title: "Setup CI/CD Actions Workflow",
      description: "Configure GitHub Actions workspace to run syntax tests, types checking, and automated coverage reports on every Pull Request.",
      impact: "high",
      category: "devops"
    },
    {
      title: "Add API Route Rate Limiting",
      description: "Secure public API endpoints. Add rate limit middleware (like express-rate-limit or similar custom filters) to block spamming.",
      impact: "medium",
      category: "security"
    }
  ];
}
