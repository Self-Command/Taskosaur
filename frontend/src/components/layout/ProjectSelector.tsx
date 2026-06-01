import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { generateSlug } from "@/utils/slugUtils";
import { getCurrentProjectId, setCurrentProjectId } from "@/utils/hierarchyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HiChevronDown, HiCheck } from "react-icons/hi2";
import { Project } from "@/types";

interface ProjectSelectorProps {
  currentWorkspaceSlug: string | null;
  currentProjectSlug: string | null;
}

export default function ProjectSelector({
  currentWorkspaceSlug,
  currentProjectSlug,
}: ProjectSelectorProps) {
  const { t } = useTranslation("sidebar");
  const router = useRouter();
  const { getProjectsByWorkspace, projects } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false); // loading starts true

  /* ---------------- fetch workspace ---------------- */
  useEffect(() => {
    // Skip if no slug or if it's an unparsed route parameter (e.g., "[workspaceSlug]")
    if (!currentWorkspaceSlug || currentWorkspaceSlug.startsWith('[')) return;

    getWorkspaceBySlug(currentWorkspaceSlug)
      .then(setCurrentWorkspace)
      .catch(() => setCurrentWorkspace(null));
  }, [currentWorkspaceSlug]);

  /* ---------------- fetch projects ---------------- */
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        await getProjectsByWorkspace(currentWorkspace.id);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [currentWorkspace?.id]);

  /* ---------------- resolve current project ---------------- */
  useEffect(() => {
    if (projects.length === 0) {
      setCurrentProject(null);
      return;
    }

    // 1. Try URL slug
    let project =
      currentProjectSlug &&
      projects.find((p) => (p.slug || generateSlug(p.name)) === currentProjectSlug);

    // 2. Fallback to localStorage id
    if (!project) {
      const storedId = getCurrentProjectId(); // util that reads localStorage
      project = projects.find((p) => p.id === storedId);
    }
    setCurrentProject(project ?? null);
  }, [projects, currentProjectSlug]);

  /* ---------------- handlers ---------------- */
  const handleProjectSelect = (project: Project) => {
    if (!currentWorkspaceSlug) return;

    setCurrentProjectId(project.id);
    window.dispatchEvent(new CustomEvent("projectChanged"));

    router.replace(`/${currentWorkspaceSlug}/${project.slug || generateSlug(project.name)}`);
  };

  /* ---------------- helpers ---------------- */
  const getProjectKey = (p: Project) => p.key || p.name.slice(0, 3).toUpperCase();

  /* ---------------- render ---------------- */
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="layout-project-selector-trigger">
          <div
            className="layout-project-selector-icon"
            style={{ backgroundColor: currentProject?.avatar ? "transparent" : (currentProject?.color || "var(--sidebar-primary)") }}
          >
            {currentProject?.avatar ? (
              <img src={currentProject.avatar} alt="" className="w-full h-full object-cover rounded-md" />
            ) : (
              currentProject ? getProjectKey(currentProject) : "P"
            )}
          </div>

          <div className="layout-project-selector-content">
            {isLoading ? (
              <div className="layout-project-selector-loading" />
            ) : (
              <div className="layout-project-selector-title">
                {currentProject ? currentProject.name : t("selectProject")}
              </div>
            )}
          </div>

          <HiChevronDown className="layout-project-selector-chevron" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="layout-project-selector-dropdown"
        align="start"
        sideOffset={8}
      >
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => handleProjectSelect(project)}
            className={`layout-project-selector-item ${currentProject?.id === project.id ? "layout-project-selector-item-selected" : ""
              }`}
          >
            <Avatar className="layout-project-selector-item-avatar">
              {project.avatar && <AvatarImage src={project.avatar} alt={project.name} />}
              <AvatarFallback
                className="layout-project-selector-item-avatar-fallback"
                style={{ backgroundColor: project.color || "var(--primary)" }}
              >
                {getProjectKey(project)}
              </AvatarFallback>
            </Avatar>

            <div className="layout-project-selector-item-content">
              <div className="layout-project-selector-item-name">{project.name}</div>
              <div className="layout-project-selector-item-description">
                {project.description || t("noDescription")}
              </div>
            </div>

            {currentProject?.id === project.id && (
              <HiCheck className="layout-project-selector-item-check" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
