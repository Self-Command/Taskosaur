import { useState, useEffect, useRef } from "react";
import {
  HiBars3, HiChatBubbleLeftRight, HiBell, HiUserGroup,
  HiSun, HiLanguage, HiMagnifyingGlass, HiBuildingOffice,
  HiMoon,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useChatContext } from "@/contexts/chat-context";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import SearchManager from "@/components/header/SearchManager";

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
      onClick={(e) => { e.stopPropagation(); setTheme(isDark ? "light" : "dark"); }}
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
      onClick={(e) => { e.stopPropagation(); toggle(); }}
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
  const { setTheme } = useTheme();
  const isDark = useIsDark();
  const { t } = useTranslation("common");
  const router = useRouter();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isAIEnabled = typeof window !== "undefined" && localStorage.getItem("aiEnabled") === "true";

  const toggleLanguage = () => {
    const currentLang = typeof window !== "undefined" ? localStorage.getItem("i18nextLng") || "en" : "en";
    const next = currentLang === "en" ? "zh" : "en";
    localStorage.setItem("i18nextLng", next);
    window.location.reload();
  };

  const handleNavClick = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleSearchClick = () => {
    setOpen(false);
    const btn = searchContainerRef.current?.querySelector("button");
    btn?.click();
  };

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
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" style={{ height: 36, width: 36, borderRadius: 12, color: isDark ? "#9ca3af" : "#4b5563" }} aria-label="Menu">
            <HiBars3 style={{ width: 20, height: 20 }} />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" aria-describedby="mobile-menu-desc" style={{
          width: "100%", maxHeight: "85vh", padding: 0,
          display: "flex", flexDirection: "column" as const,
          backgroundColor: bg, borderBottom: `1px solid ${borderB}`,
          borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          zIndex: 9999,
        } as any}>
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <SheetDescription id="mobile-menu-desc" className="sr-only">{t("menu")}</SheetDescription>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: textTitle }}>{t("menu")}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" as const, padding: "12px 12px 16px" }}>
            <button style={row}
              onClick={() => handleNavClick("/organization")}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiBuildingOffice style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("organization")}</span>
              <span style={{ fontSize: 13, color: textMuted }}>{currentOrganizationId ? t("selected") : t("notSelected")}</span>
            </button>

            <button style={row}
              onClick={() => handleNavClick("/notifications")}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiBell style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("notifications.title")}</span>
            </button>

            <button style={row}
              onClick={() => handleNavClick("/invite")}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiUserGroup style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("invitations")}</span>
            </button>

            <div style={{ margin: "12px 16px", borderTop: `1px solid ${border}` }} />

            <button style={row}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiSun style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("theme")}</span>
              <InlineThemeToggle />
            </button>

            <button style={row}
              onClick={toggleLanguage}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiLanguage style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("language")}</span>
              <InlineLangToggle />
            </button>

            <button style={row}
              onClick={handleSearchClick}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <HiMagnifyingGlass style={{ width: 20, height: 20, flexShrink: 0, color: rowIconColor }} />
              <span style={{ flex: 1 }}>{t("search")}</span>
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
                <span style={{ flex: 1 }}>{t("aiAssistant")}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: isChatOpen ? "#34d399" : (isDark ? "#374151" : "#d1d5db") }} />
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <div ref={searchContainerRef} style={{ position: "fixed", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
        <SearchManager />
      </div>
    </>
  );
}
