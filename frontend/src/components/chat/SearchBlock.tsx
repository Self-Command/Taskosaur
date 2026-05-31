import { useState } from "react";
import { HiChevronDown, HiGlobeAlt, HiArrowTopRightOnSquare } from "react-icons/hi2";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchBlockProps {
  results: SearchResult[];
  query?: string;
}

export default function SearchBlock({ results, query }: SearchBlockProps) {
  const [expanded, setExpanded] = useState(true);

  if (!results || results.length === 0) return null;

  return (
    <div className="border border-blue-200/60 dark:border-blue-800/30 rounded-xl overflow-hidden mb-3 bg-blue-50/20 dark:bg-blue-950/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-blue-100/30 dark:hover:bg-blue-900/10 transition-colors text-left"
      >
        <HiGlobeAlt className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="flex-1 text-xs font-medium text-blue-700 dark:text-blue-400">
          搜索到 {results.length} 个结果{query ? `: "${query}"` : ""}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-blue-400 transition-transform duration-200 shrink-0 ${
            expanded ? "" : "-rotate-90"
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-blue-100 dark:border-blue-800/20 px-3.5 py-2 space-y-2">
          {results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-2 rounded-lg hover:bg-blue-100/40 dark:hover:bg-blue-900/20 transition-colors group"
            >
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-bold text-blue-400 mt-0.5 shrink-0">[{i + 1}]</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate group-hover:underline flex items-center gap-1">
                    {r.title}
                    <HiArrowTopRightOnSquare className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {r.snippet && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {r.snippet}
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
