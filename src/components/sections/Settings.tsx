"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, CheckCircle, XCircle, Trash2, Eye, EyeOff, Loader2, DollarSign, Cpu } from "lucide-react";

interface ProviderKey {
  id: string;
  slug: string;
  displayName: string;
  hasKey: boolean;
  isValid: boolean;
  lastValidatedAt: string | null;
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export default function Settings() {
  const [providers, setProviders] = useState<ProviderKey[]>([]);
  const [keysInput, setKeysInput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/settings/keys");
      const data = await res.json();
      if (!data.error) {
        setProviders(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveKey = async (providerId: string, slug: string) => {
    const apiKey = keysInput[providerId];
    if (!apiKey) return;

    setLoading(prev => ({ ...prev, [providerId]: true }));
    setMessage(null);

    try {
      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: `Successfully registered and validated your ${slug.toUpperCase()} API key.` });
        setKeysInput(prev => ({ ...prev, [providerId]: "" }));
        fetchKeys();
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to validate API key." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleDeleteKey = async (providerId: string, slug: string) => {
    if (!confirm(`Are you sure you want to delete your key for ${slug.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/settings/keys?providerId=${providerId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Deleted API key for ${slug.toUpperCase()}.` });
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.1 }}
      className="space-y-10 max-w-5xl mx-auto py-8"
    >
      <motion.div variants={itemVariants} className="text-center space-y-3 mb-12">
        <h2 className="text-4xl font-black tracking-tight text-white">LLM Gateway Settings</h2>
        <p className="text-muted-foreground text-sm max-w-2xl mx-auto leading-relaxed">
          Configure your LLM providers using the <strong className="text-primary/90">Bring Your Own Key (BYOK)</strong> model. Credentials are encrypted locally using AES-256-GCM and never leave your workspace.
        </p>
      </motion.div>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-5 rounded-2xl flex items-center gap-4 border shadow-2xl backdrop-blur-md ${
              message.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5" 
                : "bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/5"
            }`}
          >
            {message.type === "success" ? <CheckCircle size={20} className="animate-pulse" /> : <XCircle size={20} />}
            <span className="text-sm font-bold tracking-wide">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-2 gap-8">
        {providers.map(p => (
          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -4, borderColor: "rgba(124,58,237,0.3)" }}
            key={p.id} 
            className="glass-panel rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between border border-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 group"
          >
            {/* Glow effect */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[60px] group-hover:bg-primary/30 transition-colors pointer-events-none"></div>

            {/* Top Info */}
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-primary shadow-lg shadow-primary/10">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-white">{p.displayName}</h3>
                    <p className="text-[10px] text-primary/70 font-bold uppercase tracking-[0.2em]">{p.slug}</p>
                  </div>
                </div>

                {p.hasKey ? (
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]">
                    <CheckCircle size={14} />
                    ACTIVE
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                    <XCircle size={14} />
                    MISSING
                  </div>
                )}
              </div>

              {p.hasKey && p.lastValidatedAt && (
                <div className="text-[11px] font-medium text-muted-foreground bg-black/30 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                  Last verified: {new Date(p.lastValidatedAt).toLocaleString()}
                </div>
              )}

              {/* Form Input */}
              <div className="space-y-3 pt-2">
                <label className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.2em] block">
                  {p.hasKey ? "Update API Key" : "Enter Configuration Key"}
                </label>
                <div className="relative group/input">
                  <input
                    type={showKey[p.id] ? "text" : "password"}
                    className="w-full bg-[#050508]/80 border border-[#20202d] rounded-2xl pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 text-white transition-all shadow-inner"
                    placeholder={p.hasKey ? "••••••••••••••••••••••••••••" : `Paste ${p.displayName} Key`}
                    value={keysInput[p.id] || ""}
                    onChange={e => setKeysInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  >
                    {showKey[p.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-4 pt-8 border-t border-white/5 mt-8 relative z-10">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_rgba(124,58,237,0.5)] transition-all disabled:opacity-50 uppercase tracking-widest"
                disabled={loading[p.id] || !keysInput[p.id]}
                onClick={() => handleSaveKey(p.id, p.slug)}
              >
                {loading[p.id] ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Test & Encrypt Key"
                )}
              </motion.button>

              {p.hasKey && (
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(239,68,68,0.2)" }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-2xl transition-colors"
                  onClick={() => handleDeleteKey(p.id, p.slug)}
                  title="Delete Key"
                >
                  <Trash2 size={18} />
                </motion.button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Local Ollama Info */}
        <motion.div 
          variants={itemVariants}
          className="glass-panel rounded-3xl p-8 flex flex-col justify-between border border-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.5)]"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Ollama (Local)</h3>
                  <p className="text-[10px] text-blue-400/80 font-bold uppercase tracking-[0.2em]">ollama</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)]">
                <CheckCircle size={14} />
                LOCALHOST
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-2xl p-5">
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Connects directly to your local Ollama runtime at <code className="text-blue-400 font-bold px-1 py-0.5 bg-blue-500/10 rounded mx-1">http://localhost:11434</code>. 
                Ensure your local server is active (<code className="text-gray-300 px-1 py-0.5 bg-white/5 rounded mx-1">ollama run llama3</code>) 
                to enable code analysis and completely private offline operations.
              </p>
            </div>
          </div>
          
          <div className="border-t border-white/5 mt-8 pt-8">
            <div className="text-xs font-bold text-muted-foreground flex items-center gap-3 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
              <DollarSign size={20} className="text-emerald-500" />
              <span>Cost per 1M tokens: <strong className="text-emerald-400 text-sm ml-1">$0.00</strong> (Unlimited Free Local Auditing)</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
