import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TEMP_BASE_DIR = path.join(process.cwd(), "src", "tmp");

// Make sure temp directory exists
if (!fs.existsSync(TEMP_BASE_DIR)) {
  fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
}

export interface FileData {
  relativePath: string;
  absolutePath: string;
  content: string;
  size: number;
}

export interface CodeEntity {
  name: string;
  type: "class" | "function" | "interface" | "struct";
  line: number;
}

export interface CodeMap {
  fileTree: any;
  files: Record<string, {
    size: number;
    language: string;
    entities: CodeEntity[];
    imports: string[];
  }>;
  dependencies: Array<{ from: string; to: string }>;
  mermaidDiagram: string;
}

// Clone a repository locally
export function cloneRepo(
  githubUrl: string,
  token?: string
): Promise<{ tempDir: string; commitSha: string; defaultBranch: string; owner: string; name: string }> {
  return new Promise((resolve, reject) => {
    // Parse GitHub URL
    // Formats: https://github.com/owner/repo, git@github.com:owner/repo, https://raw.githubusercontent.com/owner/repo/...
    const cleanedUrl = githubUrl.replace(/\.git$/, "");
    
    // Try to extract owner and repo from various github URL formats
    let owner = "";
    let name = "";
    
    const standardMatch = cleanedUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
    const rawMatch = cleanedUrl.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)/);
    
    if (standardMatch) {
      owner = standardMatch[1];
      name = standardMatch[2];
    } else if (rawMatch) {
      owner = rawMatch[1];
      name = rawMatch[2];
    } else {
      return reject(new Error("Invalid GitHub URL. Must contain github.com/owner/repo"));
    }

    const repoId = crypto.randomUUID();
    const tempDir = path.join(TEMP_BASE_DIR, repoId);

    // Build authenticated URL if token is present
    let cloneUrl = `https://github.com/${owner}/${name}.git`;
    if (token) {
      cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${name}.git`;
    }

    // Run git clone --depth 1
    exec(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`, (cloneErr) => {
      if (cloneErr) {
        return reject(new Error(`Failed to clone repository: ${cloneErr.message}`));
      }

      // Get current commit SHA
      exec("git rev-parse HEAD", { cwd: tempDir }, (shaErr, shaStdout) => {
        const commitSha = shaErr ? "unknown" : shaStdout.trim();

        // Get default branch
        exec("git symbolic-ref refs/remotes/origin/HEAD", { cwd: tempDir }, (branchErr, branchStdout) => {
          let defaultBranch = "main";
          if (!branchErr && branchStdout) {
            const parts = branchStdout.trim().split("/");
            defaultBranch = parts[parts.length - 1] || "main";
          }

          resolve({
            tempDir,
            commitSha,
            defaultBranch,
            owner,
            name
          });
        });
      });
    });
  });
}

// Clean up temporary clone directory
export function cleanupRepo(tempDir: string) {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to clean up directory ${tempDir}:`, error);
  }
}

// File extensions to traverse
const INCLUDED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".rb", ".php", ".sh", ".yaml", ".yml", ".json", ".md", ".html", ".css", ".sql"
]);

// Directories to skip
const EXCLUDED_DIRS = new Set([
  ".git", ".next", "node_modules", "dist", "build", "out", "target", "venv",
  ".venv", "env", "bin", "obj", "__pycache__", "coverage", ".idea", ".vscode"
]);

// Traverse folder and get file details
export function traverseRepo(dir: string, baseDir: string = dir): FileData[] {
  const results: FileData[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.has(file)) {
        results.push(...traverseRepo(filePath, baseDir));
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      // Skip files > 1MB or files with unlisted extensions
      if (INCLUDED_EXTENSIONS.has(ext) && stat.size < 1024 * 1024) {
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/");
          results.push({
            relativePath,
            absolutePath: filePath,
            content,
            size: stat.size
          });
        } catch (e) {
          console.error(`Error reading file ${filePath}:`, e);
        }
      }
    }
  }

  return results;
}

// Match language from file extension
export function getLanguageByExtension(ext: string): string {
  switch (ext) {
    case ".js": case ".jsx": return "javascript";
    case ".ts": case ".tsx": return "typescript";
    case ".py": return "python";
    case ".go": return "go";
    case ".rs": return "rust";
    case ".java": return "java";
    case ".c": case ".h": return "c";
    case ".cpp": case ".hpp": return "cpp";
    case ".cs": return "csharp";
    case ".rb": return "ruby";
    case ".php": return "php";
    case ".sh": return "shell";
    case ".yml": case ".yaml": return "yaml";
    case ".json": return "json";
    case ".md": return "markdown";
    case ".html": return "html";
    case ".css": return "css";
    case ".sql": return "sql";
    default: return "plaintext";
  }
}

// Fast regex parsing to extract entities & basic imports
export function analyzeCodebase(files: FileData[]): CodeMap {
  const codeMap: CodeMap = {
    fileTree: {},
    files: {},
    dependencies: [],
    mermaidDiagram: ""
  };

  const fileTree: any = {};

  for (const file of files) {
    const ext = path.extname(file.relativePath).toLowerCase();
    const lang = getLanguageByExtension(ext);
    const lines = file.content.split("\n");

    const entities: CodeEntity[] = [];
    const imports: string[] = [];

    // Parse line by line using simple rules
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Extract functions/classes based on language patterns
      if (lang === "typescript" || lang === "javascript") {
        // Classes
        const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
        if (classMatch) entities.push({ name: classMatch[1], type: "class", line: lineNum });

        // Interfaces
        const interfaceMatch = line.match(/(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/);
        if (interfaceMatch) entities.push({ name: interfaceMatch[1], type: "interface", line: lineNum });

        // Functions
        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
        if (funcMatch) {
          entities.push({ name: funcMatch[1], type: "function", line: lineNum });
        } else {
          // Arrow functions assigned to const/let
          const arrowMatch = line.match(/(?:export\s+)?const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
          if (arrowMatch) entities.push({ name: arrowMatch[1], type: "function", line: lineNum });
        }

        // Imports
        const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          imports.push(importMatch[1]);
        }
      } else if (lang === "python") {
        // Classes
        const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)/);
        if (classMatch) entities.push({ name: classMatch[1], type: "class", line: lineNum });

        // Functions
        const defMatch = line.match(/^def\s+([a-zA-Z0-9_]+)/);
        if (defMatch) entities.push({ name: defMatch[1], type: "function", line: lineNum });

        // Imports
        const importMatch1 = line.match(/^import\s+([a-zA-Z0-9_., ]+)/);
        if (importMatch1) imports.push(importMatch1[1].trim());
        const importMatch2 = line.match(/^from\s+([a-zA-Z0-9_.]+)\s+import/);
        if (importMatch2) imports.push(importMatch2[1].trim());
      } else if (lang === "go") {
        // Structs/Interfaces
        const structMatch = line.match(/^type\s+([a-zA-Z0-9_]+)\s+struct/);
        if (structMatch) entities.push({ name: structMatch[1], type: "struct", line: lineNum });
        const interfaceMatch = line.match(/^type\s+([a-zA-Z0-9_]+)\s+interface/);
        if (interfaceMatch) entities.push({ name: interfaceMatch[1], type: "interface", line: lineNum });

        // Functions
        const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)/);
        if (funcMatch) entities.push({ name: funcMatch[1], type: "function", line: lineNum });
      }
    });

    // Populate file map
    codeMap.files[file.relativePath] = {
      size: file.size,
      language: lang,
      entities,
      imports
    };

    // Add to hierarchical file tree
    const parts = file.relativePath.split("/");
    let current = fileTree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? null : {};
      }
      current = current[part];
    });

    // Resolve dependencies (simple file-to-file imports for diagram)
    imports.forEach(imp => {
      // Relative import resolution (approximate)
      if (imp.startsWith(".")) {
        const fileDir = path.dirname(file.relativePath);
        const resolved = path.normalize(path.join(fileDir, imp)).replace(/\\/g, "/");
        
        // Find if this resolved path matches any existing file (with potential extensions)
        const match = files.find(f => 
          f.relativePath === resolved || 
          f.relativePath.startsWith(resolved + ".")
        );
        if (match) {
          codeMap.dependencies.push({
            from: file.relativePath,
            to: match.relativePath
          });
        }
      }
    });
  }

  codeMap.fileTree = fileTree;

  // Generate Mermaid diagram from dependencies
  // Limit to top 15 dependencies to keep the graph readable and beautiful
  const topDeps = codeMap.dependencies.slice(0, 15);
  let mDiagram = "graph TD\n";
  mDiagram += "  %% Custom styled flowchart\n";
  mDiagram += "  classDef default fill:#1e1e2f,stroke:#8b5cf6,stroke-width:1px,color:#fff,rx:6px,ry:6px;\n";
  
  if (topDeps.length === 0) {
    // If no dependencies, map major directories
    const roots = Object.keys(fileTree).slice(0, 6);
    roots.forEach(root => {
      const id = root.replace(/[^a-zA-Z0-9]/g, "_");
      mDiagram += `  Root --> ${id}["/${root}"]\n`;
    });
  } else {
    const nodes = new Set<string>();
    topDeps.forEach(dep => {
      const fromId = dep.from.replace(/[^a-zA-Z0-9]/g, "_");
      const toId = dep.to.replace(/[^a-zA-Z0-9]/g, "_");
      const fromName = path.basename(dep.from);
      const toName = path.basename(dep.to);
      
      if (!nodes.has(fromId)) {
        mDiagram += `  ${fromId}["${fromName}"]\n`;
        nodes.add(fromId);
      }
      if (!nodes.has(toId)) {
        mDiagram += `  ${toId}["${toName}"]\n`;
        nodes.add(toId);
      }
      mDiagram += `  ${fromId} --> ${toId}\n`;
    });
  }
  
  codeMap.mermaidDiagram = mDiagram;

  return codeMap;
}
