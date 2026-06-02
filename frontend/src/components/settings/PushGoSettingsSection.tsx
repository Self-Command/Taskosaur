"use client";
import { useState, useEffect } from "react";
import { HiBellAlert, HiClipboard } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function PushGoSettingsSection() {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const [channelId, setChannelId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [c, p] = await Promise.all([
        api.get("/settings/pushgo_channel_id").catch(() => ({ value: "" })),
        api.get("/settings/pushgo_channel_password").catch(() => ({ value: "" })),
      ]);
      setChannelId((c as any)?.value || "");
      setPassword((p as any)?.value || "");
    } catch {}
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/settings/bulk", {
        settings: [
          { key: "pushgo_channel_id", value: channelId, category: "pushgo" },
          { key: "pushgo_channel_password", value: password, category: "pushgo", isEncrypted: true },
        ],
      });
      toast.success("PushGo 配置已保存");
    } catch { toast.error("保存失败"); }
    finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <HiBellAlert className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">PushGo 推送通知</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          配置 PushGo 后，任务开始/截止前10分钟自动推送通知到手机。{" "}
          <a href="https://pushgo.cn" target="_blank" rel="noopener" className="text-[var(--primary)] underline">了解 PushGo</a>
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[var(--muted-foreground)]">Channel ID</Label>
          <Input value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="PushGo App 创建的 Channel ID" className="font-mono text-sm bg-[var(--background)] border-[var(--border)]" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[var(--muted-foreground)]">Channel Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8-128 位密码" className="font-mono text-sm bg-[var(--background)] border-[var(--border)]" />
        </div>
        <ActionButton primary onClick={save} disabled={saving} className="w-full">
          {saving ? "保存中..." : "保存配置"}
        </ActionButton>
        <p className="text-xs text-[var(--muted-foreground)]">
          在 PushGo App 创建 Channel 后填入 ID 和密码即可。
        </p>
      </CardContent>
    </Card>
  );
}
