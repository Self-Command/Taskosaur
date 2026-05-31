import { useState, useEffect, useRef, useCallback } from "react";
import {
  HiXMark, HiPaperAirplane, HiSparkles, HiPlus, HiTrash,
  HiPencil, HiBars3, HiChatBubbleLeft, HiStop, HiArrowPath,
  HiUserCircle, HiGlobeAlt, HiLightBulb, HiPaperClip,
} from "react-icons/hi2";
import { useChatContext } from "@/contexts/chat-context";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import ThinkingBlock from "@/components/chat/ThinkingBlock";
import SearchBlock from "@/components/chat/SearchBlock";
import api from "@/lib/api";

type ToolExec = { tool: string; params: any; result: any; pending: boolean };
type FileAttachment = { name: string; url: string; mimeType: string; size: number; extractedText?: string };
type Message = { id: string; role: "user" | "assistant"; content: string; thinking: string; toolExecs: ToolExec[]; attachments?: FileAttachment[]; streaming: boolean };

/* ── Tool card badge ── */
function ToolBadge({ tool }: { tool: string }) {
  const map: Record<string, string> = {
    list: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    get: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    create: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    update: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    delete: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    navigate: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  };
  const key = Object.keys(map).find((k) => tool.startsWith(k));
  const cls = key ? map[key] : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  const label = key === "list" || key === "get" ? "查询" : key === "create" ? "创建" : key === "update" ? "更新" : key === "delete" ? "删除" : key === "navigate" ? "导航" : "执行";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function ToolIcon({ tool }: { tool: string }) {
  const t = tool.toLowerCase();
  if (t.includes("workspace")) return "📁";
  if (t.includes("project")) return "📋";
  if (t.includes("task") || t.includes("status") || t.includes("priority")) return "✅";
  if (t.includes("sprint")) return "🔄";
  if (t.includes("label")) return "🏷️";
  if (t.includes("member") || t.includes("user")) return "👤";
  if (t.includes("navigate")) return "🔗";
  if (t.includes("organization")) return "🏢";
  if (t.includes("comment")) return "💬";
  if (t.includes("dependency")) return "🔗";
  if (t.includes("time")) return "⏱️";
  if (t.includes("attachment")) return "📎";
  if (t.includes("workflow") || t.includes("status")) return "🔄";
  if (t.includes("setting")) return "⚙️";
  if (t.includes("notification")) return "🔔";
  if (t.includes("invitation")) return "✉️";
  if (t.includes("custom_field")) return "🏗️";
  if (t.includes("recurrence") || t.includes("recurring")) return "🔁";
  if (t.includes("share")) return "🔗";
  if (t.includes("automation")) return "🤖";
  if (t.includes("inbox")) return "📥";
  if (t.includes("activity")) return "📜";
  return "🔧";
}

/* ── Tool execution card ── */
function ToolCard({ t }: { t: ToolExec }) {
  const [open, setOpen] = useState(false);
  const opLabel = t.tool.startsWith("list") || t.tool.startsWith("get") ? "查看" : t.tool.startsWith("create") ? "创建" : t.tool.startsWith("delete") ? "删除" : t.tool.startsWith("update") ? "更新" : "执行";
  const displayName = t.tool.replace(/_/g, " ");

  return (
    <div className="border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-base shrink-0"><ToolIcon tool={t.tool} /></span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <ToolBadge tool={t.tool} />
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">{displayName}</span>
        </div>
        {t.pending ? (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {opLabel}中
          </span>
        ) : (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            完成
          </span>
        )}
        <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 px-3.5 py-3 space-y-3 text-xs">
          <div>
            <div className="font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider text-[10px]">参数</div>
            <pre className="bg-white dark:bg-gray-950 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{JSON.stringify(t.params, null, 2)}</pre>
          </div>
          <div>
            <div className="font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider text-[10px]">结果</div>
            <pre className="bg-white dark:bg-gray-950 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed max-h-60 overflow-y-auto">{JSON.stringify(t.result, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shimmer loading for messages ── */
function ShimmerMessage() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ═════════════════════════════════════════════════════════════ */

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [convs, setConvs] = useState<any[]>([]);
  const [histOpen, setHistOpen] = useState(false);
  const [convId, setConvId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [width, setWidth] = useState(440);
  const [webSearch, setWebSearch] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [thinkingStart, setThinkingStart] = useState<number>(0);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const thinkingRef = useRef(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizing = useRef(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { getCurrentUser } = useAuth();

  /* ── Resize ── */
  useEffect(() => {
    const mm = (e: MouseEvent) => { if (resizing.current) setWidth(Math.min(680, Math.max(360, window.innerWidth - e.clientX))); };
    const mu = () => { resizing.current = false; };
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, []);

  /* ── Init ── */
  useEffect(() => { const u = getCurrentUser(); if (u) { setUser(u); loadConvs(); } }, [getCurrentUser]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ── Mobile redirect ── */
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && isChatOpen) {
      toggleChat();
      router.push("/chat");
    }
  }, [isChatOpen]);

  const loadConvs = async () => { try { const r = await api.get("/ai-chat/conversations"); setConvs(r.data || []); } catch {} };

  /* ── File upload ── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${base}/ai-chat/upload`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd, credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data: FileAttachment = await res.json();
      setAttachments((p) => [...p, data]);
    } catch (err) { console.error("Upload error:", err); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  /* ── Abort controller for SSE stream ── */
  const abortRef = useRef<AbortController | null>(null);

  /* ── Send message via direct SSE streaming (no polling) ── */
  const send = async () => {
    const text = input.trim(); if ((!text && attachments.length === 0) || loading || !user) return;
    const currAtts = [...attachments];
    const um: Message = { id: "" + Date.now(), role: "user", content: text, thinking: "", toolExecs: [], attachments: currAtts, streaming: false };
    setMessages((p) => [...p, um]); setInput(""); setAttachments([]); setLoading(true);
    const aid = "" + (Date.now() + 1);
    setMessages((p) => [...p, { id: aid, role: "assistant", content: "", thinking: "", toolExecs: [], streaming: true }]);
    setIsAIThinking(false);
    thinkingRef.current = false;
    setThinkingStart(0);
    setSearchResults([]);
    setSearchQuery("");
    try {
      const parts = pathname.split("/").filter(Boolean);
      const sid = sessionId || "s" + Date.now();
      if (!sessionId) setSessionId(sid);
      const body: any = {
        message: text,
        workspaceId: parts[0] || undefined,
        projectId: parts[1] || undefined,
        sessionId: sid,
        currentOrganizationId: localStorage.getItem("currentOrganizationId"),
        enableWebSearch: webSearch,
        enableThinking: thinking,
        ...(currAtts.length > 0 ? { attachments: currAtts } : {}),
      };
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("access_token");
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(`${baseUrl}/ai-chat/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).error || `HTTP ${response.status}`);
      }
      // ── NDJSON stream reader ──
      // Format: one JSON object per line, {"t":"tx","d":"text"}, {"t":"th","d":"thinking"}, etc.
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const d = JSON.parse(line);
            switch (d.t) {
              case "ss": // search start
                setSearchQuery(d.q || "");
                setSearchResults([]);
                break;
              case "sr": // search results
                setSearchResults(d.r || []);
                break;
              case "se": break; // search end
              case "th": // thinking token
                if (!thinkingRef.current) { thinkingRef.current = true; setIsAIThinking(true); setThinkingStart(Date.now()); }
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, thinking: (last.thinking || "") + (d.d || ""), streaming: true }; return c; });
                break;
              case "tx": // text token
                if (thinkingRef.current) { thinkingRef.current = false; setIsAIThinking(false); }
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, content: (last.content || "") + (d.d || ""), streaming: true }; return c; });
                break;
              case "ts": // tool start
                if (thinkingRef.current) { thinkingRef.current = false; setIsAIThinking(false); }
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, toolExecs: [...(last.toolExecs || []), { tool: d.tool, params: d.p || {}, result: {}, pending: true }], streaming: true }; return c; });
                break;
              case "tr": // tool result
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") { const execs = (last.toolExecs || []).map((t: any) => t.tool === d.tool && t.pending ? { ...t, result: d.r || {}, pending: false } : t); c[c.length - 1] = { ...last, toolExecs: execs, streaming: true }; } return c; });
                break;
              case "nav": // navigate
                if (d.p) router.push(d.p);
                break;
              case "msg": // final message
                if (thinkingRef.current) { thinkingRef.current = false; setIsAIThinking(false); }
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, content: d.m || last.content, toolExecs: (d.e || []).map((t: any) => ({ tool: t.tool, params: t.params, result: t.result, pending: false })), streaming: false }; return c; });
                setLoading(false);
                if (d.c) setConvId(d.c);
                loadConvs();
                break;
              case "err": // error
                setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, content: "错误: " + (d.e || ""), streaming: false }; return c; });
                setLoading(false);
                break;
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.role === "assistant") c[c.length - 1] = { ...last, content: "错误: " + (err.message || "Unknown"), streaming: false }; return c; });
      setLoading(false);
    }
  };

  /* ── Key handler ── */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [loading, user, input]);

  /* ── Stop polling ── */
  const stop = () => { abortRef.current?.abort(); setLoading(false); setMessages((p) => { const c = [...p]; const last = c[c.length - 1]; if (last?.streaming) c[c.length - 1] = { ...last, streaming: false }; return c; }); };

  if (!isChatOpen) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 bg-white dark:bg-[#0f0f0f] border-l border-gray-200 dark:border-gray-800 z-50 flex flex-col overflow-hidden shadow-2xl shadow-black/10" style={{ width: `${width}px` }}>
      {/* resize handle */}
      <div onMouseDown={(e) => { e.preventDefault(); resizing.current = true; }} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 z-50 transition-colors" />

      {/* ═══ History sidebar ═══ */}
      {histOpen && (
        <>
          <div className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setHistOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#0f0f0f] border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col shadow-xl">
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">对话记录</span>
              <button onClick={() => setHistOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"><HiXMark className="w-4 h-4" /></button>
            </div>
            {/* new chat */}
            <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <button onClick={() => { abortRef.current?.abort(); setMessages([]); setConvId(""); setSessionId(""); setHistOpen(false); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-all">
                <HiPlus className="w-4 h-4" />新建对话
              </button>
            </div>
            {/* list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
              {convs.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-8">暂无对话记录</div>
              )}
              {convs.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setConvId(c.id); setSessionId(c.sessionId || ""); setHistOpen(false);
                    const msgs = (c.messages || []).map((m: any) => ({
                      id: m.id || "" + Date.now(), role: m.role,
                      content: m.content || "",
                      toolExecs: Array.isArray(m.toolExecutions) ? m.toolExecutions.map((t: any) => ({ tool: t.tool || "", params: t.params || {}, result: t.result || {}, pending: false })) : [],
                      streaming: m.status === "streaming" || m.status === "pending",
                    }));
                    setMessages(msgs);
                    // If there's a streaming message, just show loading (no polling resume)
                    const hasStreaming = (c.messages || []).some((m: any) => m.status === "streaming" || m.status === "pending");
                    if (hasStreaming) setLoading(true);
                  }}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${c.id === convId ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                >
                  <HiChatBubbleLeft className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                    {editing === c.id ? (
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={async () => { if (editTitle.trim()) { try { await api.patch(`/ai-chat/conversations/${c.id}`, { title: editTitle.trim() }); loadConvs(); } catch {} } setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") setEditing(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 text-xs w-full outline-none focus:ring-2 focus:ring-blue-500/30"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm truncate text-gray-700 dark:text-gray-300">{c.title || "New Chat"}</span>
                    )}
                    {editing !== c.id && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setEditing(c.id); setEditTitle(c.title || "New Chat"); }} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"><HiPencil className="w-3 h-3" /></button>
                        <button onClick={async (e) => { e.stopPropagation(); try { await api.delete(`/ai-chat/conversations/${c.id}`); if (convId === c.id) { setConvId(""); setMessages([]); } loadConvs(); } catch {} }} className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"><HiTrash className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Clear all */}
            {convs.length > 0 && (
              <div className="shrink-0 px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={async () => {
                    if (confirm("确定清空所有对话记录？此操作不可撤销。")) {
                      for (const c of convs) { try { await api.delete(`/ai-chat/conversations/${c.id}`); } catch {} }
                      setConvs([]); setMessages([]); setConvId(""); setSessionId("");
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-transparent text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  清空所有对话
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Header ═══ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-2.5">
          <button onClick={async () => { setHistOpen(true); await loadConvs(); }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
            <HiBars3 className="w-4.5 h-4.5" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
            <HiSparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI 助手</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={() => { abortRef.current?.abort(); setMessages([]); setConvId(""); setSessionId(""); }} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors" title="新对话">
              <HiPlus className="w-4 h-4" />
            </button>
          )}
          <button onClick={toggleChat} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <HiXMark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══ Messages ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <HiSparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1.5">有什么可以帮你的？</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">我可以管理工作区、项目和任务，也可以查询分析数据</p>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
              {[
                { text: "列出所有工作区", icon: "📁" },
                { text: "创建新任务", icon: "✅" },
                { text: "查看高优先级任务", icon: "🔍" },
                { text: "列出我的项目", icon: "📋" },
              ].map((s) => (
                <button key={s.text} onClick={() => setInput(s.text)} className="flex items-center gap-2 text-left px-3.5 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm">
                  <span className="text-sm shrink-0">{s.icon}</span>
                  <span className="truncate">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] bg-[#10b981] dark:bg-[#059669] text-white rounded-2xl rounded-br-lg px-4 py-2.5 shadow-sm">
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.attachments.map((a, i) => (
                        <a key={i} href={`${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api").replace(/\/api$/, "")}${a.url}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 bg-white/20 rounded-md px-2 py-1 text-xs hover:bg-white/30 transition-colors">
                          {a.mimeType.startsWith("image/") ? "🖼️" : "📄"} {a.name}
                        </a>
                      ))}
                    </div>
                  )}
                  {m.content && <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3 group">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <HiSparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Tool execution cards */}
                  {m.toolExecs && m.toolExecs.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {m.toolExecs.map((t, i) => <ToolCard key={i} t={t} />)}
                    </div>
                  )}
                  {/* Web Search results block */}
                  {searchResults.length > 0 && (
                    <SearchBlock results={searchResults} query={searchQuery} />
                  )}
                  {/* Thinking/reasoning block */}
                  {(m.thinking || (m.streaming && isAIThinking)) && (
                    <ThinkingBlock
                      content={m.thinking || ""}
                      isThinking={!!(m.streaming && isAIThinking)}
                      startTime={thinkingStart}
                    />
                  )}
                  {/* Text content */}
                  {m.content ? (
                    <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none break-words overflow-hidden">
                      <ChatMarkdown key={m.id} content={m.content} />
                    </div>
                  ) : m.streaming ? (
                    <div className="flex items-center gap-2 py-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {m.toolExecs && m.toolExecs.length > 0
                          ? `MCP 工具执行中 (${m.toolExecs.filter(t => t.pending).length > 0 ? `${m.toolExecs.filter(t => t.pending).length} 个进行中` : `${m.toolExecs.length} 个已完成`})`
                          : "AI 正在思考..."}
                      </span>
                    </div>
                  ) : null}
                  {/* Retry indicator */}
                  {!m.streaming && !m.content && m.toolExecs.length === 0 && (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">无响应内容</div>
                  )}
                </div>
              </div>
            )
          )
        )}
        <div ref={endRef} />
      </div>

      {/* ═══ Input ═══ */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3.5 bg-white dark:bg-[#0f0f0f]">
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative group flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs max-w-[200px]">
                {a.mimeType.startsWith("image/") ? (
                  <img src={`${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api").replace(/\/api$/, "")}${a.url}`} alt={a.name} className="w-6 h-6 rounded object-cover shrink-0" />
                ) : (<span className="text-sm shrink-0">📄</span>)}
                <span className="truncate text-gray-700 dark:text-gray-300">{a.name}</span>
                <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <HiXMark className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {uploading && <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-400"><span className="animate-pulse">⏳</span> 上传中...</span>}
          </div>
        )}
        <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={onKeyDown}
            placeholder="发送消息给 AI 助手..."
            disabled={loading || !user}
            rows={1}
            className="flex-1 px-1 py-1.5 bg-transparent border-0 resize-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none disabled:opacity-50 text-gray-800 dark:text-gray-200"
            style={{ minHeight: "28px", maxHeight: "120px" }}
          />
          <div className="flex items-center gap-0.5 shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden"
              accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.py,.java,.go,.rs,.rb,.c,.cpp,.h,.cs,.swift,.kt,.sql,.sh,.yaml,.yml,.xml,.html,.css,.docx,.xlsx" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className={`p-1.5 rounded-lg transition-colors ${uploading ? "text-emerald-500 animate-pulse" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              title="上传附件">
              <HiPaperClip className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setWebSearch(!webSearch)}
              className={`p-1.5 rounded-lg transition-colors ${webSearch ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              title={webSearch ? "已开启联网搜索" : "联网搜索"}>
              <HiGlobeAlt className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setThinking(!thinking)}
              className={`p-1.5 rounded-lg transition-colors ${thinking ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              title={thinking ? "已开启深度思考" : "深度思考"}>
              <HiLightBulb className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <button onClick={stop} className="p-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shrink-0 transition-all hover:scale-105 active:scale-95 shadow-sm" title="停止">
              <HiStop className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={send} disabled={(!input.trim() && attachments.length === 0) || loading || !user} className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl shrink-0 transition-all disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-sm disabled:shadow-none" title="发送">
              <HiPaperAirplane className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">AI 助手可能会犯错，请核实重要信息</p>
      </div>
    </div>
  );
}
