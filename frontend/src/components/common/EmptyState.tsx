import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { HiClipboardDocumentList } from "react-icons/hi2";

interface EmptyStateProps {
  searchQuery?: string;
  priorityFilter?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ searchQuery = "", priorityFilter = "all" }) => {
  const { t } = useTranslation("common");
  const noTasksMessage =
    searchQuery || priorityFilter !== "all" ? t("emptyState.noTasksFound") : t("emptyState.noTasksYet");
  const descriptionMessage =
    searchQuery || priorityFilter !== "all"
      ? t("emptyState.tryAdjustingFilters")
      : t("emptyState.createFirstTask");

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardContent className="p-8 text-center">
        <HiClipboardDocumentList
          size={48}
          className="mx-auto text-[var(--muted-foreground)] mb-4"
        />
        <CardTitle className="text-lg font-medium mb-2 text-[var(--foreground)]">
          {noTasksMessage}
        </CardTitle>
        <CardDescription className="text-sm text-[var(--muted-foreground)] mb-6">
          {descriptionMessage}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
