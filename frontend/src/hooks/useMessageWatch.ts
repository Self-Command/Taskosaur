"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { TokenManager } from "@/lib/api";

export interface WatchOptions {
  conversationId: string;
  messageId: string;
  enabled: boolean;
  onToolStart?: (data: { tool: string; params: any }) => void;
  onToolResult?: (data: { tool: string; params: any; result: any }) => void;
  onTextDelta?: (data: {
    delta: string;
    toolExecutions: any[];
    conversationId: string;
  }) => void;
  onMessage?: (data: {
    content: string;
    toolExecutions: any[];
    conversationId: string;
  }) => void;
  onError?: (data: { error: string }) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;

export function useMessageWatch(options: WatchOptions) {
  const { conversationId, messageId, enabled, onToolStart, onToolResult, onTextDelta, onMessage, onError } =
    options;

  const [isConnected, setIsConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectCount = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const disconnect = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsConnected(false);
    reconnectCount.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled || !conversationId || !messageId) {
      disconnect();
      return;
    }

    let cancelled = false;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
    const url = `${baseUrl}/ai-chat/conversations/${conversationId}/messages/${messageId}/watch`;

    const connect = async () => {
      if (cancelled) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = TokenManager.getAccessToken();
        const response = await fetch(url, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            optionsRef.current.onError?.({ error: "Message not found" });
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        setIsConnected(true);
        reconnectCount.current = 0;

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let currentData = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (line === "") {
              // Empty line = end of event
              if (currentData) {
                try {
                  const data = JSON.parse(currentData);
                  switch (currentEvent) {
                    case "tool_start":
                      optionsRef.current.onToolStart?.(data);
                      break;
                    case "tool_result":
                      optionsRef.current.onToolResult?.(data);
                      break;
                    case "text_delta":
                      optionsRef.current.onTextDelta?.(data);
                      break;
                    case "message":
                      optionsRef.current.onMessage?.(data);
                      break;
                    case "error":
                      optionsRef.current.onError?.(data);
                      break;
                  }
                } catch {}
              }
              currentEvent = "";
              currentData = "";
            } else if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            }
            // Lines starting with ":" are comments/heartbeats, ignore
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return; // intentional disconnect
        if (cancelled) return;

        // Auto-reconnect with backoff
        if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectCount.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 10000);
          await new Promise((r) => setTimeout(r, delay));
          if (!cancelled) connect();
        } else {
          optionsRef.current.onError?.({ error: "Connection lost, max retries exceeded" });
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsConnected(false);
    };
  }, [conversationId, messageId, enabled, disconnect]);

  return { disconnect, isConnected };
}
