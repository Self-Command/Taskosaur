import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ProjectsContent from "@/components/projects/ProjectsContent";
import { SEO } from "@/components/common/SEO";

export default function WorkspaceProjectsPage() {
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { t } = useTranslation("projects");

  return (
    <>
      <SEO title={t("title")} description={t("description")} />
      <ProjectsContent
        contextType="workspace"
        contextId={workspaceSlug as string}
        workspaceSlug={workspaceSlug as string}
        title={t("title")}
        description={t("description")}
        emptyStateTitle={t("empty_state_title")}
        emptyStateDescription={t("empty_state_description")}
        enablePagination={true}
        generateProjectLink={(project, ws) => {
          if (!ws || !project?.slug) return undefined;
          return `/${encodeURIComponent(ws)}/${encodeURIComponent(project.slug)}`;
        }}
      />
    </>
  );
}
