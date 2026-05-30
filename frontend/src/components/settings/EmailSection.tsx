"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import ActionButton from "@/components/common/ActionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HiEnvelope } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function EmailSection() {
  const { t } = useTranslation("settings");
  const { getCurrentUser, updateUserEmail } = useAuth();
  const currentUser = getCurrentUser();

  const fetchingRef = useRef(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (currentUser) setEmail(currentUser.email || "");
  }, [currentUser]);

  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = useCallback(async () => {
    if (!currentUser || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      await updateUserEmail(currentUser.id, { email });
      toast.success(t("profile_section.profile_updated"));
    } catch {
      toast.error(t("profile_section.profile_update_failed"));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [currentUser, email, updateUserEmail]);

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-[var(--foreground)]">
              <HiEnvelope className="w-5 h-5 text-[var(--primary)]" />
              {t("profile_section.email")}
            </CardTitle>
            <CardDescription className="text-sm text-[var(--muted-foreground)] mt-1">
              {t("profile_section.description")}
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className="text-xs bg-[var(--primary)]/10 text-[var(--primary)] border-none"
          >
            Secure
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-[var(--foreground)]">
              {t("profile_section.email")} <span className="text-red-500">*</span>
            </Label>
            <div className="max-w-md">
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="h-8 border-none bg-[var(--background)]"
                placeholder={t("profile_section.email")}
                required
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {t("profile_section.email")}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <ActionButton
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim()}
              primary
              className="h-8 px-3 text-sm bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] border-none"
            >
              {loading ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Updating...
                </div>
              ) : (
                {t("profile_section.edit_profile")}
              )}
            </ActionButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
