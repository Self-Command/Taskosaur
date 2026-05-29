import { useState, useEffect } from "react";
import {
  HiBars3, HiChatBubbleLeftRight, HiBell, HiUserGroup,
  HiSun, HiLanguage, HiMagnifyingGlass, HiBuildingOffice,
  HiMoon,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { useChatContext } from "@/contexts/chat-context";
import { useTheme } from "next-themes";

function useIsDark() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return false;
  return resolvedTheme === "dark";
}

function InlineThemeToggle() {
  const { setTheme } = useTheme();
  const isDark = useIsDark();
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
        backgroundColor: isDark ? "#374151" : "#e5e7eb",
        display: "flex", alignItems: "center", padding: 2,
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: "50%", backgroundColor: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: isDark ? "translateX(20px)" : "translateX(0)",
        transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}>
        {isDark ? <HiMoon style={{ width: 14, height: 14, color: "#6366f1" }} /> : <HiSun style={{ width: 14, height: 14, color: "#f59e0b" }} />}
      </div>
    </button>
  );
}

function InlineLangToggle() {
  const [lang, setLang] = useState(() => {
    if (typeof window === "undefined") return "en";
    return localStorage.getItem("i18nextLng") || "en";
  });
  const isDark = useIsDark();
  const toggle = () => {
    const next = lang === "en" ? "zh" : "en";
    setLang(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("i18nextLng", next);
      window.location.reload();
    }
  };
  return (
    <button
      onClick={toggle}
      style={{
        padding: "4px 10px", borderRadius: 8,
        border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
        background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
        color: isDark ? "#d1d5db" : "#374151", flexShrink: 0, minWidth: 36,
      }}
    >
      {lang === "en" ? "EN" : "中"}
    </button>
  );
}

export default function HeaderView({
  currentUser,
  currentOrganizationId,
  hasOrganizationAccess,
}: {
  currentUser: any;
  currentOrganizationId: string | null;
  hasOrganizationAccess: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toggleChat, isChatOpen } = useChatContext();
  const isDark = useIsDark();
  const isAIEnabled = typeof window !== "undefined" && localStorage.getItem("aiEnabled") === "true";

  if (!hasOrganizationAccess) return null;

  const bg = isDark ? "#0f0f0f" : "#fff";
  const border = isDark ? "#1f2937" : "#f3f4f6";
  const borderB = isDark ? "#1f2937" : "#e5e7eb";
  const text = isDark ? "#e5e7eb" : "#374151";
  const textMuted = isDark ? "#6b7280" : "#9ca3af";
  const textTitle = isDark ? "#f3f4f6" : "#1f2937";
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";
  const rowIconColor = isDark ? "#6b7280" : "#9ca3af";

  const row = {
    display: "flex" as const, alignItems: "center" as const, gap: 12,
    width: "100%", padding: "14px 16px", borderRadius: 12,
    cursor: "pointer", fontSize: 14, fontWeight: 500,
    color: text, border: "none", background: "none",
    textAlign: "left" as const, transition: "background 0.15s",
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" style={{ height: 36, width: 36, borderRadius: 12, color: isDark ? "#9ca3af" : "#4b5563" }} aria-label="Menu">
          <HiBars3 style={{ width: 20, height: 20 }} />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" style={{
        width: "100%", maxHeight: "85vh", padding: 0,
        display: "flex", flexDirection: "column" as const,
        backgroundColor: bg, borderBottom: `1px solid ${borderB}`,
        borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
      } as any}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: textTitle }}>菜单</span>
          <SheetDescription style={{ display: "none" }}>导航菜单</SheetDescription>
        </div>
        <div style={{ flex: 1, overflowY: "auto" as const, padding: "12px 12px 16px" }}>
          <button style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiBuildingOffice style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>组织</span>
            <span style={{ fontSize: 13, color: textMuted }}>{currentOrganizationId ? "已选择" : "未选择"}</span>
          </button>

          <button style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiBell style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>通知</span>
          </button>

          <button style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiUserGroup style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>邀请</span>
          </button>

          <div style={{ margin: "12px 16px", borderTop: `1px solid ${border}` }} />

          <div style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiSun style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>主题</span>
            <InlineThemeToggle />
          </div>

          <div style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiLanguage style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>语言</span>
            <InlineLangToggle />
          </div>

          <button style={row}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <HiMagnifyingGlass style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
            <span style={{ flex: 1 }}>搜索</span>
          </button>

          <div style={{ margin: "12px 16px", borderTop: `1px solid ${border}` }} />

          {toggleChat && isAIEnabled && (
            <button
              type="button"
              onClick={() => { toggleChat(); setOpen(false); }}
              style={{
                ...row,
                backgroundColor: isChatOpen ? (isDark ? "rgba(5,150,105,0.15)" : "#ecfdf5") : "transparent",
                color: isChatOpen ? "#34d399" : text,
              }}
              onMouseEnter={(e) => { if (!isChatOpen) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { if (!isChatOpen) e.currentTarget.style.background = "none"; }}
            >
              <HiChatBubbleLeftRight style={{ width: 20, height: 20, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>AI 助手</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: isChatOpen ? "#34d399" : (isDark ? "#374151" : "#d1d5db") }} />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
