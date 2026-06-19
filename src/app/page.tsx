"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Terminal, Settings as SettingsIcon, AlertCircle, 
  Github, Sparkles, Loader2, Cpu, DollarSign, Database,
  Search, ShieldAlert, GitCompare, MessageCircleCode
} from "lucide-react";
import Settings from "@/components/sections/Settings";
import Dashboard from "@/components/sections/Dashboard";

interface ModelOption {
  id: string;
  modelId: string;
  displayName: string;
  providerName: string;
  contextWindow: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

export default function Home() {
  const [view, setView] = useState<"landing" | "progress" | "dashboard" | "settings">("landing");
  
  // Form input states
  const [githubUrl, setGithubUrl] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("m2");
  const [githubToken, setGithubToken] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // App models list
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Execution states
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; status: string; logs: string[] }>({
    percent: 0,
    status: "",
    logs: []
  });

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
    
    // Restore session if user refreshed the page, or from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlAnalysisId = urlParams.get("analysisId");
    const savedAnalysisId = urlAnalysisId || localStorage.getItem("repomind_analysis_id");
    
    if (savedAnalysisId) {
      setActiveAnalysisId(savedAnalysisId);
      if (urlAnalysisId) {
        localStorage.setItem("repomind_analysis_id", urlAnalysisId);
        window.history.replaceState({}, document.title, window.location.pathname); // remove from URL
      }
      setView("progress");
    }
  }, []);

  useEffect(() => {
    if (view === "progress" && activeAnalysisId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/analyses/${activeAnalysisId}`);
          const data = await res.json();
          
          if (!data.error && data.progress) {
            setProgress({
              percent: data.progress.percent || 0,
              status: data.progress.status || data.analysis?.status,
              logs: data.progress.logs || []
            });

            if (data.analysis?.status === "completed") {
              clearInterval(interval);
              setView("dashboard");
            } else if (data.analysis?.status === "failed") {
              clearInterval(interval);
              // Try to extract the real error from the last log line
              const logs = data.progress?.logs || [];
              let errorMsg = "Code scan analysis failed. Check repository URL and permissions.";
              const lastLog = logs[logs.length - 1];
              if (lastLog && lastLog.includes("Analysis failed:")) {
                 errorMsg = lastLog.split("Analysis failed:")[1].trim();
              }
              setErrorSubmit(`Failed: ${errorMsg}`);
              setView("landing");
            }
          } else if (data.analysis?.status) {
             // Fallback if progress not fully formed
             if (data.analysis?.status === "completed") {
               clearInterval(interval);
               setView("dashboard");
             }
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [view, activeAnalysisId]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [progress.logs]);

  const fetchModels = async () => {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (!data.error) {
        setModels(data.models);
        const mini = data.models.find((m: any) => m.modelId.includes("mini") || m.modelId.includes("flash"));
        if (mini) {
          setSelectedModelId(mini.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleLaunchScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;

    setLoadingSubmit(true);
    setErrorSubmit(null);

    try {
      const resRepo = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl })
      });
      const dataRepo = await resRepo.json();

      if (!resRepo.ok || dataRepo.error) {
        throw new Error(dataRepo.error?.message || "Failed to register repository.");
      }

      const resAnalyze = await fetch(`/api/repositories/${dataRepo.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          githubToken: isPrivate ? githubToken : ""
        })
      });
      const dataAnalyze = await resAnalyze.json();

      if (!resAnalyze.ok || dataAnalyze.error) {
        throw new Error(dataAnalyze.error?.message || "Failed to launch analysis.");
      }

      setActiveAnalysisId(dataAnalyze.id);
      localStorage.setItem("repomind_analysis_id", dataAnalyze.id);
      setProgress({ percent: 0, status: "pending", logs: ["Job registered in local database..."] });
      setView("progress");

    } catch (err: any) {
      setErrorSubmit(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const selectedModelInfo = models.find(m => m.id === selectedModelId);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-between relative z-10">
      {/* Top Banner Navigation */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex justify-between items-center pb-6 border-b border-[#20202d]/30 relative z-20"
      >
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView("landing")}>
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-primary shadow-lg shadow-primary/10 group-hover:shadow-primary/30 group-hover:border-primary/60 transition-all duration-500">
            <Database size={20} className="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight text-white group-hover:text-primary-foreground transition-colors">RepoMind</span>
            <span className="text-[10px] text-primary/80 font-bold tracking-widest uppercase">Agentic Code Scanner</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView(view === "settings" ? "landing" : "settings")}
            className="px-4 py-2.5 rounded-xl text-muted-foreground hover:text-white bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 shadow-xl backdrop-blur-md transition-all flex items-center gap-2 text-sm font-bold"
          >
            <SettingsIcon size={16} className="text-primary/70" />
            {view === "settings" ? "Back to Dashboard" : "LLM Settings"}
          </motion.button>
        </div>
      </motion.header>

      {/* Primary Section */}
      <AnimatePresence mode="wait">
        <main key={view} className="flex-1 pt-16 flex flex-col justify-center relative z-20">
          {view === "landing" && (
            <motion.div 
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ staggerChildren: 0.15 }}
              className="max-w-5xl mx-auto w-full space-y-20"
            >
              {/* SaaS Banner */}
              <motion.div variants={variants} className="text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold tracking-widest uppercase text-primary shadow-[0_0_30px_-5px_rgba(124,58,237,0.3)]">
                  <Sparkles size={14} className="animate-pulse" />
                  Next-Gen Codebase Auditor
                </div>
                <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.1] text-white drop-shadow-2xl">
                  Reverse Engineer Repositories <br />
                  <span className="gradient-text">Powered by AI Orchestration</span>
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                  RepoMind deep-scans your workspace files, generates interactive structural connection graphs, indexes token costs, and provides code-aware chat context instantly.
                </p>
              </motion.div>

              {/* Form & Info Split Layout */}
              <div className="grid md:grid-cols-12 gap-8 items-stretch">
                {/* Form Input */}
                <motion.div variants={variants} className="md:col-span-7 glass-panel p-8 sm:p-10 rounded-3xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all duration-700">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  
                  <form onSubmit={handleLaunchScan} className="space-y-8 relative z-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.2em] block">
                        GitHub Repository URL
                      </label>
                      <div className="relative group/input">
                        <input
                          type="url"
                          required
                          placeholder="https://github.com/facebook/react"
                          value={githubUrl}
                          onChange={e => setGithubUrl(e.target.value)}
                          className="w-full bg-[#050508]/80 border border-[#20202d] rounded-2xl pl-5 pr-14 py-4 text-sm focus:outline-none focus:border-primary/70 focus:ring-4 focus:ring-primary/10 text-white transition-all shadow-inner"
                        />
                        <div className="absolute right-4 top-4 text-muted-foreground group-focus-within/input:text-primary transition-colors">
                          <Github size={20} />
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <label className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.2em] block">
                          Scanning Model
                        </label>
                        <div className="relative">
                          {loadingModels ? (
                            <div className="w-full bg-[#050508]/80 border border-[#20202d] rounded-2xl py-4 px-5 text-xs text-muted-foreground flex items-center gap-3">
                              <Loader2 className="animate-spin text-primary" size={14} />
                              Loading registry...
                            </div>
                          ) : (
                            <select
                              value={selectedModelId}
                              onChange={e => setSelectedModelId(e.target.value)}
                              className="w-full bg-[#050508]/80 border border-[#20202d] rounded-2xl py-4 px-5 text-xs focus:outline-none focus:border-primary/70 focus:ring-4 focus:ring-primary/10 text-white appearance-none cursor-pointer font-semibold transition-all shadow-inner"
                            >
                              {models.map(m => (
                                <option key={m.id} value={m.id} className="bg-[#050508] text-white">
                                  {m.providerName} — {m.displayName}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-center gap-2 text-xs shadow-inner backdrop-blur-xl">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Cpu size={14} className="text-primary" />
                          <span>Context Window: <strong className="text-white">{selectedModelInfo?.contextWindow?.toLocaleString() || "128k"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign size={14} className="text-emerald-400" />
                          <span>Cost (1M): <strong className="text-white">${selectedModelInfo?.inputCostPer1M || "0.0"}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5 border-t border-white/5 pt-6 mt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-white">Private Repository Access</span>
                          <p className="text-xs text-muted-foreground mt-1">Requires GitHub PAT authentication</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-[#20202d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <AnimatePresence>
                        {isPrivate && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            <label className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.2em] block">
                              Personal Access Token (PAT)
                            </label>
                            <input
                              type="password"
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                              value={githubToken}
                              onChange={e => setGithubToken(e.target.value)}
                              className="w-full bg-[#050508]/80 border border-[#20202d] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-primary/70 focus:ring-4 focus:ring-primary/10 text-white transition-all shadow-inner"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {errorSubmit && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-semibold flex items-center gap-3"
                        >
                          <AlertCircle size={16} />
                          <span>{errorSubmit}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loadingSubmit}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_40px_-10px_rgba(124,58,237,0.8)] transition-all disabled:opacity-50 text-sm uppercase tracking-widest relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                      {loadingSubmit ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Queuing pipeline...
                        </>
                      ) : (
                        <>
                          <Play size={16} fill="white" />
                          Launch AI Audit Scan
                        </>
                      )}
                    </motion.button>
                  </form>
                </motion.div>

                {/* Showcase highlights side-grid */}
                <motion.div variants={variants} className="md:col-span-5 grid grid-rows-4 gap-4">
                  {[
                    { icon: Search, title: "Codebase Traversal Scan", desc: "Recursively maps class models, function exports, and tech stacks automatically." },
                    { icon: ShieldAlert, title: "Security Audits", desc: "Checks file scopes for leaked AWS/GitHub tokens, and flags vulnerable modules." },
                    { icon: GitCompare, title: "Connection Visualizers", desc: "Generates interactive SVG dependency graphs tracking module relationships." },
                    { icon: MessageCircleCode, title: "RAG Assistant Sessions", desc: "Contextual conversation drawers to investigate bugs and code logic details." }
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <motion.div 
                        whileHover={{ x: -5, backgroundColor: "rgba(255,255,255,0.05)" }}
                        key={idx} 
                        className="flex gap-5 glass-panel p-6 rounded-3xl premium-card items-center border border-white/5 cursor-default transition-all"
                      >
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/30 text-primary shadow-lg shadow-primary/10 shrink-0">
                          <Icon size={20} />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-sm text-white tracking-wide">{item.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </motion.div>
          )}

          {view === "progress" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto w-full"
            >
              <div className="glass-panel p-8 sm:p-12 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(124,58,237,0.15)] border border-primary/20 space-y-10 relative overflow-hidden">
                {/* Glow behind progress */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary/20 blur-[100px] pointer-events-none"></div>
                
                {/* Progress Title */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="space-y-1">
                    <h2 className="font-black text-2xl text-white tracking-tight">Analyzing Repository Pipeline</h2>
                    <p className="text-sm text-primary/70 font-semibold tracking-wide uppercase">Running Active Agents Checklist</p>
                  </div>
                  <motion.div 
                    key={progress.percent}
                    initial={{ scale: 1.2, color: "#fff" }}
                    animate={{ scale: 1, color: "#a78bfa" }}
                    className="text-4xl font-black tabular-nums tracking-tighter"
                  >
                    {progress.percent}%
                  </motion.div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-black/50 rounded-full h-3 overflow-hidden border border-white/10 shadow-inner relative z-10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="bg-gradient-to-r from-primary/80 to-primary h-full rounded-full shadow-[0_0_20px_rgba(124,58,237,0.8)] relative"
                  >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_linear_infinite]"></div>
                  </motion.div>
                </div>

                {/* Active Step Indicator */}
                <div className="flex items-center gap-4 bg-black/40 border border-primary/30 rounded-2xl p-5 text-sm text-gray-300 shadow-inner backdrop-blur-md relative z-10">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Loader2 size={16} className="animate-spin text-primary" />
                  </div>
                  <span>Executing Worker Step: <strong className="text-white tracking-wider uppercase ml-1">{progress.status || "WAITING"}</strong></span>
                </div>

                {/* Terminal Logs View */}
                <div className="space-y-3 relative z-10">
                  <label className="text-xs font-bold text-primary/80 uppercase tracking-[0.2em] flex items-center gap-2 pl-1">
                    <Terminal size={14} />
                    Live Ingest Stream
                  </label>
                  <div className="bg-[#030306]/90 border border-white/10 rounded-2xl p-6 h-[280px] overflow-y-auto code-font text-xs text-emerald-400 space-y-2 shadow-inner scrollbar-thin select-text">
                    <AnimatePresence initial={false}>
                      {progress.logs.map((log, idx) => (
                        <motion.div 
                          key={idx} 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="leading-relaxed opacity-90 hover:opacity-100 hover:text-emerald-300 transition-colors"
                        >
                          {log}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "dashboard" && activeAnalysisId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Dashboard 
                analysisId={activeAnalysisId} 
                onBack={() => {
                  localStorage.removeItem("repomind_analysis_id");
                  setActiveAnalysisId(null);
                  setView("landing");
                }} 
              />
            </motion.div>
          )}

          {view === "settings" && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Settings />
             </motion.div>
          )}
        </main>
      </AnimatePresence>

      {/* Footer Banner */}
      <footer className="text-center text-xs text-muted-foreground border-t border-[#20202d]/30 pt-8 mt-20 flex justify-between items-center relative z-20 font-medium">
        <span className="opacity-60 hover:opacity-100 transition-opacity">RepoMind Workspace &copy; 2026. Codebase Auditing Platform.</span>
        <span className="px-3 py-1 bg-white/5 rounded-full border border-white/10 font-bold opacity-80">v1.1 Premium Build</span>
      </footer>
    </div>
  );
}
