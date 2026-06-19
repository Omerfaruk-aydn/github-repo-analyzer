"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Shield, AlertTriangle, Lightbulb, Code2, Folder, File, ChevronDown, ChevronRight, 
  CheckCircle2, MessageSquare, Send, Sparkles, X, FileCode2, Info, ArrowUpRight, Loader2, Play
} from "lucide-react";

interface DashboardProps {
  analysisId: string;
  onBack: () => void;
}

interface Finding {
  id: string;
  agent_type: string;
  file_path: string;
  line_start: number;
  line_end: number;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  suggested_fix: string;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 glass-panel p-5 rounded-2xl premium-card relative group overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute inset-0 bg-white/[0.01] group-hover:bg-white/[0.03] transition-colors pointer-events-none" />
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth="5" fill="transparent" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke={color}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute text-sm font-extrabold text-white">{value}%</span>
      </div>
      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function DependencyGraph({ files, onSelectFile }: { files: string[]; onSelectFile: (f: string) => void }) {
  const nodeCount = Math.min(files.length, 6);
  const center = { x: 220, y: 160 };
  const radiusX = 130;
  const radiusY = 90;
  
  const nodes = files.slice(0, nodeCount).map((f, idx) => {
    const angle = (idx / nodeCount) * 2 * Math.PI;
    const x = center.x + Math.cos(angle) * radiusX;
    const y = center.y + Math.sin(angle) * radiusY;
    return { name: f.split("/").pop(), x, y, fullPath: f };
  });

  return (
    <div className="glass-panel rounded-2xl p-6 premium-card relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#20202d]/40 relative z-10">
        <div>
          <h3 className="font-semibold text-sm">Module Connection Diagram</h3>
          <p className="text-[10px] text-muted-foreground">Laser trails track import dependency pipelines</p>
        </div>
        <span className="text-[9px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Dynamic Graph
        </span>
      </div>
      
      <div className="h-[320px] bg-[#05050a]/40 rounded-xl border border-[#20202d]/20 overflow-hidden relative z-10 flex items-center justify-center">
        <svg className="w-full h-full">
          {/* Background definitions */}
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Links and animated flow dots */}
          {nodes.map((node, i) => {
            const nextNode = nodes[(i + 1) % nodes.length];
            return (
              <g key={i}>
                {/* Connection lines */}
                <line
                  x1={node.x}
                  y1={node.y}
                  x2={nextNode.x}
                  y2={nextNode.y}
                  stroke="url(#lineGrad)"
                  strokeWidth="1.5"
                  strokeOpacity="0.25"
                  strokeDasharray="5 5"
                />
                {/* Glow path */}
                <path
                  d={`M ${node.x} ${node.y} L ${nextNode.x} ${nextNode.y}`}
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.15)"
                  strokeWidth="3"
                  filter="url(#glow)"
                  className="opacity-40"
                />
                {/* Moving laser light */}
                <circle cx="0" cy="0" r="3" fill="#22d3ee" filter="url(#glow)">
                  <animateMotion
                    dur={`${6 + i * 2}s`}
                    repeatCount="indefinite"
                    path={`M ${node.x} ${node.y} L ${nextNode.x} ${nextNode.y}`}
                  />
                </circle>
              </g>
            );
          })}

          {/* Render circular nodes */}
          {nodes.map((node, i) => (
            <g 
              key={i} 
              className="cursor-pointer group"
              onClick={() => onSelectFile(node.fullPath)}
            >
              {/* Outer ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r="36"
                fill="#07070d"
                stroke="#1f1f2e"
                strokeWidth="1.5"
                className="group-hover:stroke-primary group-hover:fill-[#0c0c16] transition-all duration-300"
              />
              {/* Inner animated ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r="31"
                fill="transparent"
                stroke="rgba(139, 92, 246, 0.05)"
                strokeWidth="1"
                className="group-hover:stroke-primary/30 group-hover:scale-105 transition-all duration-300"
              />
              <text
                x={node.x}
                y={node.y + 3}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="9"
                fontWeight="600"
                className="select-none pointer-events-none group-hover:fill-white font-sans transition-colors duration-300"
              >
                {node.name?.substring(0, 10)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function Dashboard({ analysisId, onBack }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "code" | "readme" | "roadmap">("overview");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readme, setReadme] = useState<any>(null);
  const [readmeContent, setReadmeContent] = useState("");
  const [loading, setLoading] = useState(true);

  // Code Explorer state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // Chat Drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchAnalysisDetails();
  }, [analysisId]);

  const fetchAnalysisDetails = async () => {
    try {
      const resAnalysis = await fetch(`/api/analyses/${analysisId}`);
      const dataAnalysis = await resAnalysis.json();
      
      const resFindings = await fetch(`/api/analyses/${analysisId}/findings`);
      const dataFindings = await resFindings.json();
      
      const resReadme = await fetch(`/api/analyses/${analysisId}/readme`);
      const dataReadme = await resReadme.json();

      if (!dataAnalysis.error) {
        setAnalysisData(dataAnalysis);
      }
      if (!dataFindings.error) {
        setFindings(dataFindings.findings);
      }
      if (!dataReadme.error) {
        setReadme(dataReadme);
        setReadmeContent(dataReadme.content_markdown);
      }
      
      const filesList = getFilesListFromFindings(dataFindings.findings);
      if (filesList.length > 0) {
        handleFileSelect(filesList[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getFilesListFromFindings = (findingList: Finding[]) => {
    const list = findingList
      .map(f => f.file_path)
      .filter(f => f && f.length > 0);
    return Array.from(new Set(list));
  };

  const handleFileSelect = async (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent("// Loading file content...");
    
    try {
      const res = await fetch(`/api/repositories/${analysisData.repository.id}/files?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to load file content.");
      }
      
      setFileContent(data.content);
    } catch (e: any) {
      setFileContent(`// Error loading file: ${filePath}\n// Details: ${e.message}`);
    }
  };

  const handleSaveReadme = async () => {
    try {
      const res = await fetch(`/api/analyses/${analysisId}/readme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: readmeContent })
      });
      const data = await res.json();
      if (!data.error) {
        setReadme(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = { id: Date.now().toString(), role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: analysisData.repository.id,
          sessionId: chatSessionId,
          message: userMsg.content,
          modelId: analysisData.analysis.config_json ? JSON.parse(analysisData.analysis.config_json).modelId : "m2"
        })
      });
      const data = await res.json();

      if (!data.error) {
        setChatSessionId(data.sessionId);
        setChatMessages(prev => [...prev, data.message]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-muted-foreground text-xs">Loading premium workspace dashboard...</p>
      </div>
    );
  }

  const bugs = findings.filter(f => f.agent_type === "bug");
  const security = findings.filter(f => f.agent_type === "security");
  const suggestions = findings.filter(f => f.agent_type === "suggestions");

  const criticalIssues = security.filter(f => f.severity === "critical" || f.severity === "high").length +
                         bugs.filter(f => f.severity === "critical" || f.severity === "high").length;

  const parsedFiles = analysisData?.codeMap?.files 
    ? Object.keys(analysisData.codeMap.files) 
    : [];

  const uniqueFiles = parsedFiles.length > 0 
    ? parsedFiles 
    : Array.from(new Set([
        ...bugs.map(b => b.file_path),
        ...security.map(s => s.file_path)
      ])).filter(f => f && f.length > 0);

  // Group files into tree structures
  const rootNode: FileNode = { name: "Root", path: "", isDirectory: true, children: [] };
  uniqueFiles.forEach(fPath => {
    const parts = fPath.split("/");
    let current = rootNode;
    let currentPath = "";
    
    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = idx === parts.length - 1;
      
      let existingNode = current.children?.find(n => n.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: isLast ? undefined : []
        };
        current.children?.push(existingNode);
      }
      current = existingNode;
    });
  });

  const renderFileTree = (node: FileNode) => {
    if (node.isDirectory) {
      const isOpen = openFolders[node.path] ?? true;
      return (
        <div key={node.path} className="pl-3.5 select-none">
          <div 
            className="flex items-center gap-1.5 py-1.5 px-2 hover:bg-white/[0.03] rounded-lg cursor-pointer text-gray-300 text-xs font-semibold transition-colors"
            onClick={() => toggleFolder(node.path)}
          >
            {isOpen ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
            <Folder size={13} className="text-primary" />
            <span>{node.name}</span>
          </div>
          {isOpen && node.children?.map(child => renderFileTree(child))}
        </div>
      );
    } else {
      const isSelected = selectedFile === node.path;
      const fileBugs = bugs.filter(b => b.file_path === node.path);
      const fileSec = security.filter(s => s.file_path === node.path);
      const badgeCount = fileBugs.length + fileSec.length;

      return (
        <div 
          key={node.path}
          className={`flex items-center justify-between py-1.5 px-3 pl-8 rounded-lg cursor-pointer text-xs transition-all border ${
            isSelected 
              ? "bg-primary/10 border-primary/30 text-white font-semibold" 
              : "border-transparent text-gray-400 hover:bg-white/[0.02]"
          }`}
          onClick={() => handleFileSelect(node.path)}
        >
          <div className="flex items-center gap-1.5 truncate">
            <File size={13} className={isSelected ? "text-primary" : "text-muted-foreground"} />
            <span className="truncate">{node.name}</span>
          </div>
          {badgeCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              fileSec.length > 0 ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {badgeCount}
            </span>
          )}
        </div>
      );
    }
  };

  return (
    <div className="space-y-8 relative pb-12">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 border-b border-[#20202d]/40 pb-6 relative z-10">
        <div>
          <button 
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-white mb-2.5 flex items-center gap-1 transition-colors"
          >
            &larr; Back to repository launchpad
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{analysisData?.repository?.owner}/{analysisData?.repository?.name}</h1>
            <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 shadow-sm">
              Synced
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Active Commit SHA: <code className="text-gray-300 code-font bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded-md">{analysisData?.analysis?.commit_sha?.substring(0, 7)}</code>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setChatOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2.5 px-4.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
          >
            <MessageSquare size={14} />
            Ask Assistant
          </button>
        </div>
      </div>

      {/* Primary Tab Selectors */}
      <div className="flex border-b border-[#20202d]/30 gap-6 relative z-10">
        {[
          { id: "overview", label: "Dashboard Overview", icon: Info },
          { id: "code", label: "Interactive Code Explorer", icon: Code2 },
          { id: "readme", label: "README Documentation", icon: FileText },
          { id: "roadmap", label: "Development Roadmap", icon: Lightbulb }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all relative top-[1px] ${
                isActive ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-gray-200"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="relative z-10">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* Circular Progress Metrics Rings */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <CircularProgress value={92} label="Code Quality" color="#7c3aed" />
              <CircularProgress value={85} label="Security Safety" color="#ef4444" />
              <CircularProgress value={95} label="Arch Integrity" color="#06b6d4" />
              <CircularProgress value={80} label="Unit Coverage" color="#10b981" />
            </div>

            {/* Layout Split: Connection graph + Details summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
                <DependencyGraph 
                  files={uniqueFiles} 
                  onSelectFile={(filePath) => {
                    setActiveTab("code");
                    handleFileSelect(filePath);
                  }}
                />
              </div>

              {/* Statistics side-panel */}
              <div className="md:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between premium-card">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-sm">Auditing Details</h3>
                    <p className="text-[10px] text-muted-foreground">Scanned directories metrics</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Vulnerabilities Detected:</span>
                      <span className="font-bold text-red-400">{security.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Memory Leaks / Bug Blocks:</span>
                      <span className="font-bold text-amber-400">{bugs.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Technical Backlog Cards:</span>
                      <span className="font-bold text-blue-400">{suggestions.length}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#20202d]/30 pt-6 mt-6">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Scan Cost:</span>
                    <span className="font-extrabold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md">
                      ${analysisData?.analysis?.total_cost_usd?.toFixed(3) || "0.000"} USD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "code" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[500px] animate-fade-in">
            {/* Left tree navigation */}
            <div className="md:col-span-4 glass-panel rounded-2xl p-4 overflow-y-auto max-h-[550px] space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 pl-1">
                Workspace Traversal Tree
              </h3>
              <div className="space-y-1">
                {rootNode.children?.map(child => renderFileTree(child))}
              </div>
            </div>

            {/* Right code and details viewer */}
            <div className="md:col-span-8 flex flex-col gap-6">
              {/* Code window */}
              <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 max-h-[420px] premium-card">
                <div className="bg-[#0b0b10] border-b border-[#20202d]/30 py-2.5 px-4.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 size={13} className="text-primary" />
                    <span className="text-xs font-semibold text-gray-200 code-font">{selectedFile || "Select a module..."}</span>
                  </div>
                </div>

                <pre className="p-4 bg-[#050508]/80 text-gray-300 text-xs code-font overflow-auto flex-1 select-text scrollbar-thin leading-relaxed">
                  <code>
                    {fileContent.split("\n").map((line, idx) => {
                      const lineNum = idx + 1;
                      const lineFinding = findings.find(f => f.file_path === selectedFile && lineNum >= f.line_start && lineNum <= f.line_end);
                      
                      return (
                        <div 
                          key={idx} 
                          className={`flex hover:bg-white/[0.03] py-0.5 px-2 -mx-2 transition-colors ${
                            lineFinding 
                              ? lineFinding.agent_type === "security" 
                                ? "bg-red-500/10 border-l-2 border-red-500" 
                                : "bg-amber-500/10 border-l-2 border-amber-500"
                              : ""
                          }`}
                        >
                          <span className="w-8 text-[10px] text-muted-foreground select-none block shrink-0">{lineNum}</span>
                          <span className="whitespace-pre">{line}</span>
                        </div>
                      );
                    })}
                  </code>
                </pre>
              </div>

              {/* Findings detailing cards */}
              {selectedFile && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
                    Findings Inside This Module ({findings.filter(f => f.file_path === selectedFile).length})
                  </h4>
                  
                  <div className="space-y-4">
                    {findings
                      .filter(f => f.file_path === selectedFile)
                      .map(f => (
                        <div 
                          key={f.id} 
                          className={`glass-panel rounded-2xl p-6 border-l-4 premium-card ${
                            f.severity === "critical" || f.severity === "high" || f.agent_type === "security"
                              ? "border-l-red-500" 
                              : "border-l-amber-500"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                                f.severity === "critical" || f.severity === "high" || f.agent_type === "security"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {f.severity}
                              </span>
                              <span className="text-xs text-muted-foreground font-semibold code-font bg-white/[0.02] border border-white/[0.04] px-2 py-0.5 rounded-md">
                                Lines {f.line_start}-{f.line_end}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">{f.category}</span>
                          </div>

                          <h5 className="font-bold text-sm mb-2 text-white">{f.title}</h5>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{f.description}</p>

                          {f.suggested_fix && (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block pl-0.5">
                                Proposed Correction:
                              </label>
                              <pre className="p-4 bg-black/60 rounded-xl text-[11px] code-font text-green-400 overflow-x-auto select-text border border-[#20202d]/30">
                                <code>{f.suggested_fix}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}

                    {findings.filter(f => f.file_path === selectedFile).length === 0 && (
                      <div className="glass-panel p-6 rounded-2xl flex items-center justify-center gap-3 text-xs text-muted-foreground">
                        <CheckCircle2 size={16} className="text-green-500" />
                        No code vulnerabilities or bugs detected in this module.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* README Documentation tab */}
        {activeTab === "readme" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px] animate-fade-in">
            {/* Markdown source */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#20202d]/45 pb-3">
                <h3 className="font-semibold text-sm">Markdown Source</h3>
                <button
                  onClick={handleSaveReadme}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs py-1.5 px-3.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  Save & Version (v{readme ? readme.version + 1 : 1})
                </button>
              </div>
              <textarea
                value={readmeContent}
                onChange={e => setReadmeContent(e.target.value)}
                className="w-full flex-1 bg-[#050508]/60 border border-[#20202d]/35 rounded-xl p-4 text-xs code-font focus:outline-none focus:border-primary/50 text-gray-200 leading-relaxed resize-none h-[420px]"
              />
            </div>

            {/* Markdown render output */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#20202d]/45 pb-3">
                <h3 className="font-semibold text-sm">HTML Preview</h3>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">v{readme?.version || 1}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[#050508]/30 border border-[#20202d]/25 rounded-xl text-xs leading-relaxed text-gray-300 space-y-4 max-h-[420px] select-text">
                {readmeContent.split("\n").map((line, idx) => {
                  if (line.startsWith("# ")) {
                    return <h1 key={idx} className="text-lg font-bold border-b border-[#20202d]/45 pb-2 text-white">{line.replace("# ", "")}</h1>;
                  } else if (line.startsWith("## ")) {
                    return <h2 key={idx} className="text-sm font-semibold text-white pt-2">{line.replace("## ", "")}</h2>;
                  } else if (line.startsWith("- ")) {
                    return <li key={idx} className="ml-4 list-disc">{line.replace("- ", "")}</li>;
                  } else if (line.startsWith("```")) {
                    return null;
                  } else {
                    return <p key={idx}>{line}</p>;
                  }
                })}
              </div>
            </div>
          </div>
        )}

        {/* Roadmap boards */}
        {activeTab === "roadmap" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* Column 1 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-red-500/20 pb-3 pl-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Critical Upgrades</span>
                <span className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                  {findings.filter(f => f.agent_type === "suggestions" && f.severity === "high").length}
                </span>
              </div>

              <div className="space-y-4">
                {findings
                  .filter(f => f.agent_type === "suggestions" && f.severity === "high")
                  .map(s => (
                    <div key={s.id} className="glass-panel p-5 rounded-2xl premium-card">
                      <h4 className="font-bold text-sm mb-2 text-white">{s.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                      <div className="mt-5 pt-3 border-t border-[#20202d]/20 flex justify-between items-center text-[9px] text-muted-foreground uppercase font-bold">
                        <span>Effort: Short</span>
                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">Critical</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 pl-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Backlog Operations</span>
                <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {findings.filter(f => f.agent_type === "suggestions" && f.severity === "medium").length}
                </span>
              </div>

              <div className="space-y-4">
                {findings
                  .filter(f => f.agent_type === "suggestions" && f.severity === "medium")
                  .map(s => (
                    <div key={s.id} className="glass-panel p-5 rounded-2xl premium-card">
                      <h4 className="font-bold text-sm mb-2 text-white">{s.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                      <div className="mt-5 pt-3 border-t border-[#20202d]/20 flex justify-between items-center text-[9px] text-muted-foreground uppercase font-bold">
                        <span>Effort: Medium</span>
                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">Important</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Column 3 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-3 pl-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Future Enhancements</span>
                <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                  {findings.filter(f => f.agent_type === "suggestions" && (f.severity === "low" || !f.severity)).length}
                </span>
              </div>

              <div className="space-y-4">
                {findings
                  .filter(f => f.agent_type === "suggestions" && (f.severity === "low" || !f.severity))
                  .map(s => (
                    <div key={s.id} className="glass-panel p-5 rounded-2xl premium-card">
                      <h4 className="font-bold text-sm mb-2 text-white">{s.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                      <div className="mt-5 pt-3 border-t border-[#20202d]/20 flex justify-between items-center text-[9px] text-muted-foreground uppercase font-bold">
                        <span>Effort: Long</span>
                        <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">Backlog</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RAG Chat Sidebar Drawer */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-[#07070c]/95 border-l border-[#20202d] shadow-2xl z-50 flex flex-col justify-between overflow-hidden animate-slide-in backdrop-blur-md">
          {/* Header */}
          <div className="p-4.5 border-b border-[#20202d] bg-[#0c0c14] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-primary animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-white">RepoMind Assistant</h3>
                <p className="text-[10px] text-muted-foreground">RAG-powered codebase agent</p>
              </div>
            </div>
            <button 
              onClick={() => setChatOpen(false)}
              className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4.5 overflow-y-auto space-y-4 select-text">
            {chatMessages.length === 0 && (
              <div className="text-center py-16 px-6 space-y-4">
                <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto text-primary border border-primary/20 shadow-md">
                  <MessageSquare size={24} />
                </div>
                <h4 className="text-sm font-bold text-gray-200">Start a Code Conversation</h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Ask targeted questions about parameters mapping, imports references, or functional architectures.
                </p>
              </div>
            )}

            {chatMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] rounded-2xl p-4 leading-relaxed text-xs border ${
                  msg.role === "user" 
                    ? "bg-primary/10 border-primary/20 text-white ml-auto" 
                    : "bg-[#0b0b11] border-[#20202d] text-gray-300"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {/* Citations badges */}
                {msg.citedFiles && msg.citedFiles.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#20202d]/60 space-y-1.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold block">References:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citedFiles.map((cFile: string) => (
                        <button
                          key={cFile}
                          onClick={() => {
                            setActiveTab("code");
                            handleFileSelect(cFile);
                            setChatOpen(false);
                          }}
                          className="text-[9px] bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors font-medium"
                        >
                          <FileCode2 size={10} />
                          {cFile.split("/").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="bg-[#0b0b11] border border-[#20202d] rounded-2xl p-4 text-xs text-muted-foreground flex items-center gap-2 max-w-[80%]">
                <Loader2 size={14} className="animate-spin text-primary" />
                Querying context vectors & writing answer...
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div className="p-4.5 border-t border-[#20202d] bg-[#0c0c14]/40 flex gap-2.5">
            <input
              type="text"
              placeholder="Query anything from the workspace..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              className="flex-1 bg-[#05050a] border border-[#20202d] rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || chatLoading}
              className="bg-primary hover:bg-primary/90 p-2.5 rounded-xl text-white disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
