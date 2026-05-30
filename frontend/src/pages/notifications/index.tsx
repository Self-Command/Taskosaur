import { useAuth } from "@/contexts/auth-context";
import NotificationScreen from "@/components/notifications/NotificationScreen";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { SEO } from "@/components/common/SEO";
import { useTranslation } from "react-i18next";

export default function NotificationPage({}) {
  const { user } = useAuth();
  const { getCurrentOrganizationId } = useWorkspaceContext();
  const currentOrganizationId = getCurrentOrganizationId();
  const { t } = useTranslation();

  // Show error if user or organization not found
  if (!user || !currentOrganizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SEO title={t("notifications.pageTitle")} />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("notifications.accessDenied")}</h1>
          <p className="text-gray-600">
            Please log in and select an organization to view notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={t("notifications.pageTitle")} />
      <NotificationScreen userId={user.id} organizationId={currentOrganizationId} />
    </>
  );
}
