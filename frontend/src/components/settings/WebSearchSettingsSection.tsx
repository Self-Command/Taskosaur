"use client";
import { useState, useEffect } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function WebSearchSettingsSection() {
  const [provider, setProvider] = useState("ddg");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const p = await api.get("/settings/web_search_provider") as any;
      const k = await api.get("/settings/web_search_api_key") as any;
      setProvider(p?.data?.value || p?.value || "ddg");
      setApiKey(k?.data?.value || k?.value || "");
    } catch {}
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/settings/bulk", {
        settings: [
          { key: "web_search_provider", value: provider, category: "ai" },
          { key: "web_search_api_key", value: apiKey, category: "ai", isEncrypted: true },
        ],
      });
      toast.success("搜索配置已保存");
    } catch { toast.error("保存失败"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <HiMagnifyingGlass className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">AI 联网搜索</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          配置搜索引擎，AI 对话时可联网获取实时信息。Bing API 免费 3000 次/月。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[var(--muted-foreground)]">搜索提供方</Label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
          >
            <option value="ddg">DuckDuckGo（免费，不保证可达）</option>
            <option value="bing">Bing Web Search（免费 3000次/月）</option>
          </select>
        </div>
        {provider === "bing" && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-[var(--muted-foreground)]">Bing API Key</Label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="从 Azure Portal 获取" className="font-mono text-sm bg-[var(--background)] border-[var(--border)]" />
          </div>
        )}
        <ActionButton primary onClick={save} disabled={saving} className="w-full">
          {saving ? "保存中..." : "保存配置"}
        </ActionButton>
      </CardContent>
    </Card>
  );
}
