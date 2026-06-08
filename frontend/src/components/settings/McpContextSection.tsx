"use client";
import { useState, useEffect, useCallback } from "react";
import { HiCpuChip } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ActionButton from "@/components/common/ActionButton";
import { toast } from "sonner";

export default function McpContextSection() {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const [wsId, setWsId] = useState("");
  const [projId, setProjId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string; organizationId: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string }[]>([]);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    try {
      // Load saved defaults
      const [wsRes, projRes] = await Promise.all([
        api.get("/settings/mcp_default_workspace", { params: { defaultValue: "" } }),
        api.get("/settings/mcp_default_project", { params: { defaultValue: "" } }),
      ]);
      const wsData = wsRes?.data || wsRes;
      const projData = projRes?.data || projRes;
      const savedWs = wsData?.value || "";
      const savedProj = projData?.value || "";
      setWsId(savedWs);
      setProjId(savedProj);

      // Load workspace list from user's organizations
      const orgRes = await api.get("/organizations");
      const orgs = orgRes?.data || orgRes || [];
      const allWs: typeof workspaces = [];
      for (const org of Array.isArray(orgs) ? orgs : orgs?.organizations || []) {
        try {
          const wsList = await api.get(`/workspaces`, { params: { organizationId: org.id } });
          const wsData2 = wsList?.data || wsList;
          const items = wsData2?.workspaces || wsData2 || [];
          if (Array.isArray(items)) {
            for (const w of items) {
              allWs.push({ id: w.id, name: w.name, slug: w.slug, organizationId: org.id });
            }
          }
        } catch { /* skip */ }
      }
      setWorkspaces(allWs);

      // If saved workspace, load its projects
      if (savedWs) {
        try {
          const projList = await api.get("/projects", { params: { workspaceId: savedWs } });
          const projData2 = projList?.data || projList;
          const items = projData2?.projects || projData2 || [];
          setProjects(Array.isArray(items) ? items : []);
        } catch { /* skip */ }
      }
    } catch {
      // use empty
    } finally {
      setLoading(false);
    }
  };

  const onWsChange = useCallback(async (newWsId: string) => {
    setWsId(newWsId);
    setProjId("");
    setProjects([]);
    if (!newWsId) return;
    try {
      const projList = await api.get("/projects", { params: { workspaceId: newWsId } });
      const projData = projList?.data || projList;
      const items = projData?.projects || projData || [];
      setProjects(Array.isArray(items) ? items : []);
    } catch { /* skip */ }
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/settings/bulk", {
        settings: [
          {
            key: "mcp_default_workspace",
            value: wsId,
            description: "Default workspace for MCP tool queries",
            category: "mcp",
          },
          {
            key: "mcp_default_project",
            value: projId,
            description: "Default project for MCP tool queries",
            category: "mcp",
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
          <HiCpuChip className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">MCP 默认上下文</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          设置默认 workspace 和 project，AI 调用工具时无需每次指定范围，节省 token 和往返次数。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <div className="text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">默认 Workspace</div>
                <select
                  value={wsId}
                  onChange={(e) => onWsChange(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="">不设置</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">默认 Project</div>
                <select
                  value={projId}
                  onChange={(e) => setProjId(e.target.value)}
                  disabled={!wsId}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-50"
                >
                  <option value="">不设置</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
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
