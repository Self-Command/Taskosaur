import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { projectApi } from "@/utils/api/projectApi";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";

// Helper: Decode URI component and convert slug-like text into Title Case
const formatSegment = (segment: string) => {
  try {
    const decoded = decodeURIComponent(segment);
    // If decoding changed the string significantly (contains non-ASCII), use decoded
    if (/[^\x00-\x7F]/.test(decoded)) {
      return decoded;
    }
    return decoded.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

// Helper: Detect if a segment is a UUID
const isUUID = (segment: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
};

// Helper: Extract UUID from taskId (format: uuid-slug)
const extractUuid = (taskId: string) => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = taskId.match(uuidPattern);
  return match ? match[0] : taskId;
};

interface BreadcrumbItem {
  name: string;
  href?: string;
  current: boolean;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const { workspaceTree } = useWorkspace();
  const { isAuthenticated } = useAuth();
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Sync with actual window location (handles pushState)
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Initial sync
    updatePath();
    
    // Listen to popstate (back/forward)
    window.addEventListener('popstate', updatePath);
    
    // Monkey-patch history.pushState and replaceState to detect URL changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      updatePath();
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      updatePath();
    };
    
    return () => {
      window.removeEventListener('popstate', updatePath);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Use currentPath (from window.location) instead of pathname (from Next.js)
  const pathToUse = currentPath || pathname;

  useEffect(() => {
    if (!pathToUse) {
      setBreadcrumbs([]);
      return;
    }

    // Skip breadcrumb for certain paths
    if (
      pathToUse === "/dashboard" ||
      pathToUse === "/dashboard/" ||
      pathToUse === "/tasks" ||
      pathToUse === "/tasks/" ||
      pathToUse === "/settings" ||
      pathToUse === "/settings/"
    ) {
      setBreadcrumbs([]);
      return;
    }

    const segments = pathToUse.split("/").filter((seg) => seg.length > 0);

    // Check if this is a sprint detail page: /[workspace]/[project]/sprints/[sprintId]
    const isSprintDetail = segments.length === 4 &&
                           segments[2] === 'sprints' &&
                           segments[3];

    // Check if this is a task detail page
    // Patterns: /tasks/[slug], /[workspace]/tasks/[slug], /[workspace]/[project]/tasks/[slug]
    const taskSegmentIndex = segments.findIndex((seg, idx) => seg === 'tasks' && idx < segments.length - 1);

    // Handle sprint detail page
    if (isSprintDetail) {
      const sprintIdOrSlug = segments[3];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sprintIdOrSlug);

      const fetchSprintBreadcrumb = async () => {
        try {
          const sprintResponse = isUUID
            ? await api.get(`/sprints/${encodeURIComponent(sprintIdOrSlug)}`)
            : await api.get(`/sprints/by-slug/${encodeURIComponent(segments[1])}/${encodeURIComponent(sprintIdOrSlug)}`);
          const sprint = sprintResponse.data;

          const items: BreadcrumbItem[] = [];

          // Add workspace - try to get actual name from workspaceTree or API
          let wsName = formatSegment(segments[0]);
          const wsFromTree = workspaceTree?.find(w => w.slug === segments[0]);
          if (wsFromTree) {
            wsName = wsFromTree.name;
          } else {
            try {
              const wsRes = await api.get(`/public/workspaces/${encodeURIComponent(segments[0])}`);
              if (wsRes?.data?.name) wsName = wsRes.data.name;
            } catch {}
          }

          items.push({
            name: wsName,
            href: `/${segments[0]}`,
            current: false,
          });

          // Add project - fetch actual name from API
          let pgName = formatSegment(segments[1]);
          try {
            const project = await projectApi.getProjectBySlug(segments[1], isAuthenticated, segments[0]);
            if (project?.name) pgName = project.name;
          } catch {}

          items.push({
            name: pgName,
            href: `/${segments[0]}/${segments[1]}`,
            current: false,
          });

          // Add sprint name (current)
          items.push({
            name: sprint?.name || formatSegment(sprintIdOrSlug),
            current: true,
          });

          setBreadcrumbs(items);
        } catch (error) {
          console.error('Failed to fetch sprint data for breadcrumb:', error);
          buildBreadcrumbFromSegments(segments);
        }
      };
      fetchSprintBreadcrumb();
      return;
    }

    if (taskSegmentIndex !== -1 && taskSegmentIndex < segments.length - 1) {
      const taskIdOrSlug = segments[taskSegmentIndex + 1];

      const fetchTaskBreadcrumb = async () => {
        try {
          const response = await api.get(`/tasks/key/${encodeURIComponent(taskIdOrSlug)}`);
          const task = response.data;

          const items: BreadcrumbItem[] = [];

          const urlWorkspace = taskSegmentIndex >= 1 && segments[0] !== 'tasks' ? segments[0] : null;
          const urlProject = taskSegmentIndex >= 2 && segments[1] !== 'tasks' ? segments[1] : null;

          const wsSlug = urlWorkspace || task.project?.workspace?.slug;
          const wsName = task.project?.workspace?.name;

          const pgSlug = urlProject || task.project?.slug;
          const pgName = task.project?.name;

          // Add workspace
          if (wsSlug) {
            items.push({
              name: wsName || formatSegment(wsSlug),
              href: `/${wsSlug}`,
              current: false,
            });
          }

          // Add project
          if (pgSlug && wsSlug) {
            items.push({
              name: pgName || formatSegment(pgSlug),
              href: `/${wsSlug}/${pgSlug}`,
              current: false,
            });
          }

          if (pgSlug && wsSlug) {
            items.push({
              name: 'Tasks',
              href: `/${wsSlug}/${pgSlug}/tasks`,
              current: false,
            });
          }

          // Add task (current)
          const taskName = task.title || task.name || decodeURIComponent(task.slug || taskIdOrSlug).replace(/-/g, ' ');
          items.push({
            name: taskName,
            current: true,
          });

          setBreadcrumbs(items);
        } catch (error) {
          console.error('Failed to fetch task data for breadcrumb:', error);
          buildBreadcrumbFromSegments(segments);
        }
      };
      fetchTaskBreadcrumb();
      return;
    }

    // Default: build breadcrumb from URL segments
    buildBreadcrumbFromSegments(segments);
  }, [pathToUse]);

  const workspaceRoutes = ["projects", "members", "activities", "tasks", "analytics", "settings", "sprints", "calendar"];

  const buildBreadcrumbFromSegments = async (segments: string[]) => {
    const baseItems: BreadcrumbItem[] = [];
    const workspaceSegment = segments[0];

    if (workspaceTree && workspaceTree.length > 0 && workspaceSegment) {
      const workspace = workspaceTree.find(w => w.slug === workspaceSegment);
      if (workspace && workspace.path) {
        const ancestorIds = workspace.path.split('/').filter(Boolean);
        if (ancestorIds[ancestorIds.length - 1] === workspace.id) {
          ancestorIds.pop();
        }

        ancestorIds.forEach(id => {
          const ancestor = workspaceTree.find(w => w.id === id);
          if (ancestor) {
            baseItems.push({
              name: ancestor.name,
              href: `/${ancestor.slug}`,
              current: false,
            });
          }
        });
      }
    }

    // Determine if there's a project segment to look up
    const hasProject = segments.length >= 2 && !workspaceRoutes.includes(segments[1]);
    let projectName: string | null = null;

    if (hasProject) {
      try {
        const project = await projectApi.getProjectBySlug(segments[1], isAuthenticated, segments[0]);
        projectName = project?.name || null;
      } catch {
        // Fall back to formatSegment if API call fails
      }
    }

    // Also try to resolve workspace name via API if not in tree
    let workspaceName: string | null = null;
    if (workspaceSegment && workspaceTree?.length > 0) {
      const ws = workspaceTree.find(w => w.slug === workspaceSegment);
      if (ws) workspaceName = ws.name;
    }
    // Fallback: try public workspace API
    if (!workspaceName && workspaceSegment) {
      try {
        const wsRes = await api.get(`/public/workspaces/${encodeURIComponent(workspaceSegment)}`);
        if (wsRes?.data?.name) workspaceName = wsRes.data.name;
      } catch {
        // Fall through to formatSegment
      }
    }

    const items = segments.map((seg, idx) => {
      const href = "/" + segments.slice(0, idx + 1).join("/");
      let displayName = formatSegment(seg);

      if (idx === 0 && workspaceName) {
        displayName = workspaceName;
      }

      if (idx === 1 && projectName) {
        displayName = projectName;
      }

      return {
        name: displayName,
        href,
        current: idx === segments.length - 1,
      };
    });

    setBreadcrumbs([...baseItems, ...items]);
  };

  if (
    !pathToUse ||
    pathToUse === "/dashboard" ||
    pathToUse === "/dashboard/" ||
    pathToUse === "/tasks" ||
    pathToUse === "/tasks/" ||
    pathToUse === "/settings" ||
    pathToUse === "/settings/" ||
    breadcrumbs.length === 0
  ) {
    return null;
  }

  return (
    <div className="breadcrumb-container">
      <div className="">
        <ShadcnBreadcrumb>
          <BreadcrumbList className="breadcrumb-nav">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="breadcrumb-link">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="breadcrumb-separator">
              <ChevronRight className="breadcrumb-separator-icon" />
            </BreadcrumbSeparator>
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={item.href}>
                <BreadcrumbItem className="breadcrumb-item">
                  {item.current ? (
                    <BreadcrumbPage className="breadcrumb-current">
                      <span className="breadcrumb-current-text">{item.name}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href} className="breadcrumb-link">
                        <span className="breadcrumb-link-text">{item.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="breadcrumb-separator">
                    <ChevronRight className="breadcrumb-separator-icon" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </ShadcnBreadcrumb>
      </div>
    </div>
  );
}
