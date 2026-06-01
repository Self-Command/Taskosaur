import React from 'react';
import ChatMarkdown from '@/components/chat/ChatMarkdown';
import { decodeHtml } from '@/utils/sanitize-content';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
  mentions?: any[];
}

/**
 * Unified markdown renderer — same rendering pipeline as AI chat output.
 * Supports GFM tables, math (KaTeX), Mermaid diagrams, syntax highlighting.
 */
export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = ({
  content,
  mentions = []
}) => {
  const hasHtmlEntities = /&[a-z]+;|&#\d+;/i.test(content);
  const decodedContent = hasHtmlEntities ? decodeHtml(content) : content;

  const processedContent = React.useMemo(() => {
    let text = decodedContent;
    if (mentions.length > 0) {
      text = text.replace(
        /@\[mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
        (_match, uuid) => {
          const mention = mentions.find(m => m.id === uuid);
          const label = mention ? `@${mention.label}` : `@user`;
          const ws = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
          return `[${label}](/${ws}/members/${uuid})`;
        }
      );
    }
    return text;
  }, [decodedContent, mentions]);

  return <ChatMarkdown content={processedContent} />;
};
