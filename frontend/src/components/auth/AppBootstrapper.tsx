import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";
import { authApi } from "@/utils/api/authApi";
import { TokenManager } from "@/lib/api";
import SplashScreen from "../common/SplashScreen";
import AppProviders from "./AppProviders";
import OrgProviders from "./OrgProvider";
import PublicProviders from "./PublicProviders";
import { LayoutProvider } from "@/contexts/layout-context";
import i18n from "@/lib/i18n";

interface AppBootstrapperProps {
  children: React.ReactNode;
}

type InitPhase = "SYSTEM_CHECK" | "READY";

// Persist across page refreshes — users-exist check almost never changes
const getCachedUsersExist = (): boolean | null => {
  try {
    const v = localStorage.getItem('__tu');
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};
const setCachedUsersExist = (val: boolean) => {
  try { localStorage.setItem('__tu', JSON.stringify(val)); } catch {}
};

export default function AppBootstrapper({ children }: AppBootstrapperProps) {
  const router = useRouter();
  const {
    getCurrentUser,
    isAuthenticated: contextIsAuthenticated,
    isLoading: authLoading,
    checkOrganizationAndRedirect,
  } = useAuth();

  const [phase, setPhase] = useState<InitPhase>("SYSTEM_CHECK");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isInitialized = useRef(false);
  const cachedAuth = useRef(false);
  const cachedOrg = useRef(false);

  const publicRoutes = [
    "/login", "/register", "/forgot-password", "/reset-password",
    "/terms-of-service", "/privacy-policy", "/setup",
    "/public/task/[token]", "/invite", "/invite/invalid",
  ];

  const handleSystemCheck = async () => {
    const skipRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/terms-of-service", "/privacy-policy", "/public/"];
    if (skipRoutes.some(r => router.pathname.startsWith(r)) || router.pathname === "/setup") {
      return true;
    }

    try {
      let exists = getCachedUsersExist();
      if (exists === null) {
        const res = await authApi.checkUsersExist();
        exists = res.exists;
        setCachedUsersExist(exists);
      }
      if (!exists) {
        setIsRedirecting(true);
        router.replace("/setup");
        return false;
      }
    } catch {
      try {
        const setupStatus = await authApi.checkSetupStatus();
        if (setupStatus?.required) {
          setIsRedirecting(true);
          router.replace("/setup");
          return false;
        }
      } catch {
        const hasToken = typeof window !== "undefined" && (
          localStorage.getItem("access_token") ||
          document.cookie.includes("access_token")
        );
        if (!hasToken) {
          setIsRedirecting(true);
          router.replace("/setup");
          return false;
        }
      }
    }
    return true;
  };

  const handleAuthCheck = useCallback(async () => {
    if (!router.isReady) return { isAuth: false, isOrg: false };

    const isPublicRoute =
      publicRoutes.includes(router.pathname) ||
      router.pathname.startsWith("/public/task/") ||
      (typeof window !== "undefined" && window.location.pathname.startsWith("/public/"));

    const isProjectRoute = router.pathname.includes("/[workspaceSlug]/[projectSlug]") ||
      (typeof window !== "undefined" && /\/[^\/]+\/[^\/]+/.test(window.location.pathname) && !window.location.pathname.startsWith("/public/") && !window.location.pathname.startsWith("/admin"));

    const actualPath = typeof window !== "undefined" ? window.location.pathname : router.asPath.split("?")[0];
    const isSettingsOrMembersRoute = actualPath.endsWith("/settings") || actualPath.endsWith("/members");
    const isPublicProjectRoute = isProjectRoute && !isSettingsOrMembersRoute;

    try {
      const accessToken = TokenManager.getAccessToken();
      const currentOrgId = TokenManager.getCurrentOrgId();
      const currentUser = getCurrentUser();
      const contextAuth = typeof contextIsAuthenticated === "function" ? contextIsAuthenticated() : contextIsAuthenticated;

      const isAuth = !!(accessToken && currentUser && contextAuth);

      if (!isAuth) {
        if (isPublicRoute || isPublicProjectRoute) {
          return { isAuth: false, isOrg: false };
        }
        return { isAuth: false, redirectPath: "/login", isOrg: false };
      }

      if (isPublicRoute) {
        const authPages = ["/login", "/register", "/forgot-password", "/reset-password", "/setup"];
        if (!authPages.includes(router.pathname)) {
          return { isAuth: true, isOrg: true };
        }
        if (typeof checkOrganizationAndRedirect === "function") {
          const orgRedirect = await checkOrganizationAndRedirect();
          if (!currentOrgId && orgRedirect === "/organization") {
            return { isAuth: true, redirectPath: "/organization", isOrg: false };
          }
        }
        return { isAuth: true, redirectPath: "/dashboard", isOrg: true };
      }

      if (router.pathname.startsWith("/admin")) {
        return { isAuth: true, isOrg: true };
      }

      if (typeof checkOrganizationAndRedirect === "function") {
        const orgRedirect = await checkOrganizationAndRedirect();
        if (currentOrgId && router.pathname === "/organization") {
          return { isAuth: true, redirectPath: "/dashboard", isOrg: true };
        }
        if (!currentOrgId && orgRedirect === "/organization") {
          return { isAuth: true, redirectPath: "/organization", isOrg: false };
        }
      }
      return { isAuth: true, isOrg: true };
    } catch {
      return { isAuth: false, redirectPath: "/login", isOrg: false };
    }
  }, [router.isReady, router.pathname, contextIsAuthenticated, getCurrentUser, checkOrganizationAndRedirect]);

  // First load: full async bootstrap
  useEffect(() => {
    if (authLoading || !router.isReady) return;

    const bootstrap = async () => {
      if (isInitialized.current) return;

      const [systemReady, authResult] = await Promise.all([
        handleSystemCheck(),
        handleAuthCheck(),
      ]);
      if (!systemReady) return;

      const { isAuth, redirectPath, isOrg } = authResult;
      cachedAuth.current = isAuth;
      cachedOrg.current = isOrg;

      if (redirectPath && redirectPath !== router.pathname) {
        if (!isAuth && redirectPath === "/login") {
          TokenManager.clearTokens();
        }
        await router.replace(redirectPath);
      }

      setIsAuthenticated(isAuth);
      setHasOrganization(isOrg);
      setPhase("READY");
      isInitialized.current = true;
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, router.isReady]);

  // Subsequent navigations: sync-only check (no network call unless token changed)
  useEffect(() => {
    if (!isInitialized.current || !router.isReady) return;

    const hasToken = !!TokenManager.getAccessToken();
    if (hasToken === cachedAuth.current) return; // no change, skip

    // Token appeared or disappeared — re-run full check
    handleAuthCheck().then(authResult => {
      cachedAuth.current = authResult.isAuth;
      cachedOrg.current = authResult.isOrg;
      setIsAuthenticated(authResult.isAuth);
      setHasOrganization(authResult.isOrg);

      if (authResult.redirectPath && authResult.redirectPath !== router.pathname) {
        if (!authResult.isAuth && authResult.redirectPath === "/login") {
          TokenManager.clearTokens();
        }
        router.replace(authResult.redirectPath);
      }
    });
  }, [router.pathname]);

  // Language sync
  useEffect(() => {
    if (isAuthenticated) {
      const user = getCurrentUser();
      const targetLang = user?.language || "en";
      if (targetLang !== i18n.language) {
        i18n.changeLanguage(targetLang);
      }
    }
  }, [isAuthenticated, getCurrentUser]);

  if (phase !== "READY" || isRedirecting) {
    const text = phase === "SYSTEM_CHECK" ? "Checking system status" : "Loading";
    return <SplashScreen statusText={text} isExiting={phase === "READY"} />;
  }

  // Routing
  const isPublicRoute = publicRoutes.includes(router.pathname) || router.pathname.startsWith("/public/task/") || (typeof window !== "undefined" && window.location.pathname.startsWith("/public/"));
  const isProjectRoute = router.pathname.includes("/[workspaceSlug]/[projectSlug]") || (typeof window !== "undefined" && /\/[^\/]+\/[^\/]+/.test(window.location.pathname) && !window.location.pathname.startsWith("/public/") && !window.location.pathname.startsWith("/admin"));
  const actualPath = typeof window !== "undefined" ? window.location.pathname : router.asPath.split("?")[0];
  const isSettingsOrMembersRoute = actualPath.endsWith("/settings") || actualPath.endsWith("/members");
  const isPublicProjectRoute = isProjectRoute && !isSettingsOrMembersRoute;
  const is404 = router.pathname === "/404";

  if (is404 || isPublicRoute || router.pathname === "/chat") {
    return <LayoutProvider>{children}</LayoutProvider>;
  }

  if (isPublicProjectRoute && !isAuthenticated) {
    return (
      <LayoutProvider>
        <PublicProviders>{children}</PublicProviders>
      </LayoutProvider>
    );
  }

  if (isAuthenticated && hasOrganization) {
    return <AppProviders>{children}</AppProviders>;
  }

  if (isAuthenticated && !hasOrganization) {
    return (
      <LayoutProvider>
        <OrgProviders>{children}</OrgProviders>
      </LayoutProvider>
    );
  }

  return null;
}
