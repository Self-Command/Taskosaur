"use client";
import { useState, useEffect } from "react";
import { HiBellAlert } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function ReminderSettingsSection() {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const [startMinutes, setStartMinutes] = useState("10");
  const [dueMinutes, setDueMinutes] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const res1 = await api.get("/settings/reminder_start_minutes", {
        params: { defaultValue: "10" },
      });
      const res2 = await api.get("/settings/reminder_due_minutes", {
        params: { defaultValue: "10" },
      });
      const d1 = res1?.data || res1;
      const d2 = res2?.data || res2;
      setStartMinutes(d1?.value || "10");
      setDueMinutes(d2?.value || "10");
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const s = parseInt(startMinutes, 10);
    const d = parseInt(dueMinutes, 10);
    if (!Number.isFinite(s) || s < 0 || !Number.isFinite(d) || d < 0) {
      toast.error("请输入有效的分钟数");
      return;
    }
    setSaving(true);
    try {
      await api.post("/settings/bulk", {
        settings: [
          {
            key: "reminder_start_minutes",
            value: String(s),
            description: "任务开始前多少分钟推送提醒",
            category: "reminder",
          },
          {
            key: "reminder_due_minutes",
            value: String(d),
            description: "任务截止前多少分钟推送提醒",
            category: "reminder",
          },
        ],
      });
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <HiBellAlert className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            推送提醒
          </h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          设置任务开始和截止前，提前多少分钟推送通知。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <div className="text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">
                  开始前提醒 (分钟)
                </div>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={startMinutes}
                  onChange={(e) => setStartMinutes(e.target.value)}
                  className="bg-[var(--background)] border-[var(--border)]"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">
                  截止前提醒 (分钟)
                </div>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={dueMinutes}
                  onChange={(e) => setDueMinutes(e.target.value)}
                  className="bg-[var(--background)] border-[var(--border)]"
                />
              </div>
            </div>
            <ActionButton onClick={save} disabled={saving} className="w-full">
              {saving ? "保存中..." : "保存"}
            </ActionButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
