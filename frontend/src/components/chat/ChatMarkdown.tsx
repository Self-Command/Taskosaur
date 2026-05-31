import { useMemo, memo } from "react";
import { Viewer } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import math from "@bytemd/plugin-math";
import mermaid from "@bytemd/plugin-mermaid";
import highlight from "@bytemd/plugin-highlight";
import "bytemd/dist/index.css";

const plugins = [gfm(), math(), mermaid(), highlight()];

function preprocess(value: string): string {
  if (!value) return "";
  return value
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, m) => `$${m.trim()}$`)
    .replace(/\[\s+((?:\$|\\|\.|\w)[^\]]*?)\s+\]/g, (m, inner) => {
      if (/\$|\\[a-zA-Z]+/.test(inner)) return `\n$$\n${inner.trim()}\n$$\n`;
      return m;
    });
}

const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  const processed = useMemo(() => preprocess(content), [content]);
  return (
    <div className="chat-markdown-wrapper" key={content.length}>
      <Viewer value={processed} plugins={plugins} />
    </div>
  );
});

export default ChatMarkdown;
