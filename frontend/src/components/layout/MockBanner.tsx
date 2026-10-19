import { AlertTriangle } from "lucide-react";
import { USE_MOCK } from "@/lib/api-client";
import { useT } from "@/lib/i18n";

export function MockBanner() {
  const { t } = useT();
  if (!USE_MOCK) return null;
  return (
    <div className="glass mx-auto mt-4 flex max-w-7xl items-start gap-3 rounded-2xl border-amber-300/30 bg-amber-400/5 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div>
        <div className="font-semibold text-amber-200">{t("banner.mock.title")}</div>
        <div className="text-amber-100/80">{t("banner.mock.body")}</div>
      </div>
    </div>
  );
}
