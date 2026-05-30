"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiExclamationTriangle } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function DeleteAccountSection() {
  const { t } = useTranslation("settings");
  const { getCurrentUser, deleteUser } = useAuth();
  const currentUser = getCurrentUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!currentUser) return;
    if (!confirm(t("danger_zone_section.confirm_message"))) return;
    setLoading(true);
    try {
      await deleteUser(currentUser.id);
      toast.success(t("danger_zone_section.delete_success"));
      router.push("/login");
    } catch {
      toast.error(t("danger_zone_section.delete_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-md bg-red-50 shadow-sm border border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-semibold text-red-700">
          <HiExclamationTriangle className="w-5 h-5" /> {t("danger_zone_section.title")}
        </CardTitle>
        <CardDescription className="text-red-500">
          {t("danger_zone_section.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
          {loading ? t("danger_zone_section.processing") : t("danger_zone_section.delete_button")}
        </Button>
      </CardContent>
    </Card>
  );
}
