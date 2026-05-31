import { useState, useEffect, useRef } from "react";
import { HiChevronDown, HiLightBulb, HiSparkles } from "react-icons/hi2";

interface ThinkingBlockProps {
  content: string;
  isThinking: boolean;
  startTime?: number;
}

export default function ThinkingBlock({ content, isThinking, startTime }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand when thinking, auto-collapse when done (if user hasn't manually toggled)
  const userToggled = useRef(false);
  useEffect(() => {
    if (!userToggled.current) {
      setExpanded(isThinking || !!content);
    }
  }, [isThinking, content]);

  useEffect(() => {
    if (!isThinking && startTime && !duration) {
      setDuration(Date.now() - startTime);
    }
  }, [isThinking, startTime, duration]);

  // Auto-scroll to bottom as thinking text streams in
  useEffect(() => {
    if (expanded && scrollRef.current && isThinking) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, expanded, isThinking]);

  if (!content && !isThinking) return null;

  const fmtDuration = duration >= 1000
    ? `${(duration / 1000).toFixed(1)}s`
    : duration > 0 ? `${duration}ms` : "";

  return (
    <div className="border border-amber-200/60 dark:border-amber-800/30 rounded-xl overflow-hidden mb-3 bg-amber-50/20 dark:bg-amber-950/5">
      {/* Header — always visible, clickable toggle */}
      <button
        onClick={() => { userToggled.current = true; setExpanded(!expanded); }}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-amber-100/30 dark:hover:bg-amber-900/10 transition-colors text-left"
      >
        {isThinking ? (
          <HiSparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
        ) : (
          <HiLightBulb className="w-4 h-4 text-amber-500/70 shrink-0" />
        )}
        <span className="flex-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          {isThinking
            ? "正在思考..."
            : `深度思考${fmtDuration ? ` (用时 ${fmtDuration})` : ""}`}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-amber-400 transition-transform duration-200 shrink-0 ${
            expanded ? "" : "-rotate-90"
          }`}
        />
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div
          ref={scrollRef}
          className="border-t border-amber-100 dark:border-amber-800/20 px-3.5 py-3 max-h-64 overflow-y-auto"
        >
          <div className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/70 whitespace-pre-wrap break-words font-mono">
            {content || (isThinking ? "..." : "")}
          </div>
        </div>
      )}
    </div>
  );
}
