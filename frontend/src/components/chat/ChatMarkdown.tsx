import { Viewer } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import math from "@bytemd/plugin-math";
import mermaid from "@bytemd/plugin-mermaid";
import highlight from "@bytemd/plugin-highlight";
import "bytemd/dist/index.css";

const plugins = [gfm(), math(), mermaid(), highlight()];

// Standard LaTeX preprocessor — all AI chat apps need this.
// Converts AI output like [ \LaTeX ] and \( \LaTeX \) into $$...$$ and $...$
// that remark-math / KaTeX can parse.
function preprocess(value: string): string {
  return value
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, m) => `$${m.trim()}$`)
    .replace(/\[\s+((?:\$|\\|\.|\w)[^\]]*?)\s+\]/g, (m, inner) => {
      // Only convert if it looks like LaTeX (contains \commands or $)
      if (/\$|\\[a-zA-Z]+/.test(inner)) return `\n$$\n${inner.trim()}\n$$\n`;
      return m;
    });
}

export default function ChatMarkdown({ content }: { content: string }) {
  return <Viewer value={preprocess(content)} plugins={plugins} />;
}
