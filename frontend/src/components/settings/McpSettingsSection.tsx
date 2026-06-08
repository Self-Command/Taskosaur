"use client";
import { useState, useEffect } from "react";
import { HiServer, HiClipboard, HiArrowPath, HiInformationCircle } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function McpSettingsSection() {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadKey(); }, [user]);

  const loadKey = async () => {
    try {
      const res = await api.get("/settings/mcp-api-key/my");
      const data = res?.data || res;
      setApiKey(data?.apiKey || "");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("已复制");
  };

  const regenerate = async () => {
    if (!confirm("重新生成后旧 Key 将立即失效，确认？")) return;
    try {
      const res = (await api.post("/settings/mcp-api-key/regenerate")) as any;
      setApiKey(res?.apiKey || "");
      toast.success("新 Key 已生成");
    } catch {
      toast.error("生成失败");
    }
  };

  const mcpUrl =
    (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "") ||
      window.location.origin) + "/mcp";

  if (!user) return null;

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <HiServer className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">MCP Server</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          用于 LobeHub 等 MCP 客户端接入，直接调用项目工具的增删改查能力。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <div className="text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : (
          <>
            {/* MCP Server URL */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--muted-foreground)]">
                MCP Server URL
              </div>
              <Input
                value={mcpUrl}
                readOnly
                className="font-mono text-sm bg-[var(--background)] border-[var(--border)]"
              />
            </div>

            {/* MCP API Key */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--muted-foreground)]">
                MCP API Key
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={apiKey}
                  readOnly
                  className="font-mono text-sm bg-[var(--background)] border-[var(--border)]"
                />
                <ActionButton secondary onClick={copy} className="shrink-0">
                  <HiClipboard className="w-4 h-4" />
                </ActionButton>
                <ActionButton secondary onClick={regenerate} className="shrink-0">
                  <HiArrowPath className="w-4 h-4" />
                </ActionButton>
              </div>
            </div>

            {/* Connection info */}
            <div className="rounded-md bg-[var(--primary)]/5 border border-[var(--primary)]/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--primary)]">
                <HiInformationCircle className="w-3.5 h-3.5" />
                LobeHub 接入配置
              </div>
              <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                <div className="flex gap-2">
                  <span className="text-[var(--foreground)]/60 shrink-0">协议:</span>
                  <span>Streamable HTTP (MCP 2025-03-26)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--foreground)]/60 shrink-0">认证:</span>
                  <span>Bearer Token</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--foreground)]/60 shrink-0">URL:</span>
                  <code className="text-[var(--primary)]">{mcpUrl}</code>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--foreground)]/60 shrink-0">Key:</span>
                  <span>上方 MCP API Key</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
