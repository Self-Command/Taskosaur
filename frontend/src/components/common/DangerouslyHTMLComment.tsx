import React from 'react';
import ChatMarkdown from '@/components/chat/ChatMarkdown';
import { decodeHtml } from '@/utils/sanitize-content';

interface DangerouslyHTMLCommentProps {
  comment: string;
}

export function DangerouslyHTMLComment({ comment }: DangerouslyHTMLCommentProps) {
  const hasHtmlEntities = /&[a-z]+;|&#\d+;/i.test(comment);
  const contentToRender = hasHtmlEntities ? decodeHtml(comment) : comment;

  // Custom sanitize schema to allow common HTML tags
  return <ChatMarkdown content={contentToRender} />;
}
