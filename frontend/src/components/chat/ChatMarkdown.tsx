import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { HiClipboard, HiCheck } from "react-icons/hi2";
import { useState } from "react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="my-3 rounded-xl overflow-x-auto border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100/80 dark:bg-gray-800/80 text-xs text-gray-500 dark:text-gray-400 font-medium">
        <span className="font-mono tracking-wide">{language || "code"}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          {copied ? <HiCheck className="w-3.5 h-3.5 text-emerald-500" /> : <HiClipboard className="w-3.5 h-3.5" />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <SyntaxHighlighter style={oneDark} language={language || "text"} PreTag="div" customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px", padding: "16px" }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const codeStr = String(children).replace(/\n$/, "");
          if (match) return <CodeBlock language={match[1]} code={codeStr} />;
          const isInline = !String(children).includes("\n");
          if (isInline) {
            return <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md text-[13px] font-mono text-rose-600 dark:text-rose-400" {...props}>{children}</code>;
          }
          return <CodeBlock language="" code={codeStr} />;
        },
        table({ children }) {
          return <div className="overflow-x-auto my-3 rounded-xl border border-gray-200 dark:border-gray-700"><table className="min-w-full border-collapse text-sm">{children}</table></div>;
        },
        th({ children }) {
          return <th className="border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">{children}</th>;
        },
        td({ children }) {
          return <td className="border-b border-gray-100 dark:border-gray-800 px-4 py-2.5 text-gray-700 dark:text-gray-300">{children}</td>;
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold mt-5 mb-2 text-gray-900 dark:text-gray-100">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold mt-3 mb-1.5 text-gray-800 dark:text-gray-200">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="text-sm font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200">{children}</h4>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-6 my-2 space-y-1 text-gray-700 dark:text-gray-300">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 my-2 space-y-1 text-gray-700 dark:text-gray-300">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        p({ children }) {
          return <p className="my-2 leading-7">{children}</p>;
        },
        strong({ children }) {
          return <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>;
        },
        a({ children, href }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">{children}</a>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-4 border-emerald-400 dark:border-emerald-600 pl-4 my-3 text-gray-600 dark:text-gray-400 italic">{children}</blockquote>;
        },
        hr() {
          return <hr className="my-4 border-gray-200 dark:border-gray-700" />;
        },
        img({ src, alt }) {
          return <img src={src} alt={alt} className="rounded-xl my-3 max-w-full h-auto" />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
