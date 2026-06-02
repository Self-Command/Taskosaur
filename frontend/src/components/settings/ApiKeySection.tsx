"use client";
import { useState, useEffect } from "react";
import { HiKey, HiClipboard, HiArrowPath } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function ApiKeySection() {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadKey(); }, [user]);

  const loadKey = async () => {
    try {
      const res = await api.get("/settings/api-key/my");
      // axios interceptor returns response.data, but also handle raw axios response
      const data = res?.data || res;
      const key = data?.apiKey || "";
      setApiKey(key);
    } catch (e: any) {
      // ignore — user not logged in or no key yet
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("已复制");
  };

  const regenerate = async () => {
    if (!confirm("重新生成后旧Key将失效，确认？")) return;
    try {
      const res = await api.post("/settings/api-key/regenerate") as any;
      setApiKey(res?.apiKey || "");
      toast.success("新Key已生成");
    } catch { toast.error("生成失败"); }
  };

  if (!user) return null;

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <HiKey className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">AI API Key</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          第三方 App 接入项目 AI 时使用此 Key 作为密钥。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <div className="text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--muted-foreground)]">API Host</div>
              <Input value={`${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, '') || window.location.origin}/v1`} readOnly className="font-mono text-sm bg-[var(--background)] border-[var(--border)]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--muted-foreground)]">API Key</div>
              <div className="flex items-center gap-2">
                <Input value={apiKey} readOnly className="font-mono text-sm bg-[var(--background)] border-[var(--border)]" />
                <ActionButton secondary onClick={copy} className="shrink-0">
                  <HiClipboard className="w-4 h-4" />
                </ActionButton>
                <ActionButton secondary onClick={regenerate} className="shrink-0">
                  <HiArrowPath className="w-4 h-4" />
                </ActionButton>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              模型名称：taskosaur
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
