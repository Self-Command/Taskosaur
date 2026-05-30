import { Repeat } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface RecurringBadgeProps {
    className?: string;
}

export default function RecurringBadge({ className = '' }: RecurringBadgeProps) {
    const { t } = useTranslation("common");
    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium ${className}`}
        >
            <Repeat size={12} />
            <span>{t("recurring")}</span>
        </div>
    );
}
