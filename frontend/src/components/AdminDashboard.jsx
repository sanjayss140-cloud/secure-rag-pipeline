import React, { useEffect, useState } from "react";
import { BarChart3, Users, Files, MessageSquare, Zap, DollarSign, Clock, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { apiGetAdminStats, checkDetailedHealth } from "../services/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, healthRes] = await Promise.all([
        apiGetAdminStats(),
        checkDetailedHealth().catch(() => null),
      ]);
      setStats(statsRes.metrics);
      setHealth(healthRes);
    } catch (err) {
      setError(err.message || "Failed to load admin analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = stats
    ? [
        {
          title: "Total Registered Users",
          value: stats.total_users,
          icon: <Users className="w-5 h-5 text-indigo-400" />,
          color: "border-indigo-500/20 bg-indigo-500/5",
        },
        {
          title: "Indexed Documents",
          value: stats.total_documents,
          icon: <Files className="w-5 h-5 text-purple-400" />,
          color: "border-purple-500/20 bg-purple-500/5",
        },
        {
          title: "Total Conversations",
          value: stats.total_conversations,
          icon: <MessageSquare className="w-5 h-5 text-cyan-400" />,
          color: "border-cyan-500/20 bg-cyan-500/5",
        },
        {
          title: "Questions Answered",
          value: stats.total_questions,
          icon: <Zap className="w-5 h-5 text-amber-400" />,
          color: "border-amber-500/20 bg-amber-500/5",
        },
        {
          title: "Total Tokens Processed",
          value: stats.total_tokens_used?.toLocaleString() || "0",
          icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
          color: "border-emerald-500/20 bg-emerald-500/5",
        },
        {
          title: "Estimated LLM Cost",
          value: `$${stats.total_estimated_cost_usd || "0.0000"}`,
          icon: <DollarSign className="w-5 h-5 text-green-400" />,
          color: "border-green-500/20 bg-green-500/5",
        },
        {
          title: "Avg Response Latency",
          value: `${stats.average_latency_ms || 0} ms`,
          icon: <Clock className="w-5 h-5 text-blue-400" />,
          color: "border-blue-500/20 bg-blue-500/5",
        },
        {
          title: "Failed Requests",
          value: stats.failed_requests || 0,
          icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
          color: "border-rose-500/20 bg-rose-500/5",
        },
      ]
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Admin Observability Dashboard</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#A855F7]/20 text-[#C084FC] text-[10px] font-bold border border-[#C084FC]/30">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Real-time monitoring of RAG token consumption, API latency, cost estimates, and system health.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold border border-white/10 transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl border backdrop-blur-md transition shadow-lg ${card.color}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#9CA3AF]">{card.title}</span>
              <div className="p-2 rounded-xl bg-white/[0.04]">{card.icon}</div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
          </div>
        ))}
      </div>

      {/* System Diagnostic Diagnostics */}
      {health && (
        <div className="p-6 rounded-2xl border border-white/5 bg-[#131A2E]/80 backdrop-blur-md shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C084FC]" />
            Component Diagnostics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#9CA3AF]">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="font-semibold text-white mb-1">API & Database</p>
              <p>ORM: {health.components?.database?.orm}</p>
              <p>Status: <span className="text-emerald-400 font-medium">Connected</span></p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="font-semibold text-white mb-1">Vector Storage</p>
              <p>Engine: {health.components?.vector_store?.type}</p>
              <p>Status: <span className="text-emerald-400 font-medium">Ready</span></p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="font-semibold text-white mb-1">LLM Provider</p>
              <p>Engine: {health.components?.llm_engine?.provider}</p>
              <p>Model: <span className="text-[#C084FC] font-medium">{health.components?.llm_engine?.model}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
