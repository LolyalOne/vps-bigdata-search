import { Phone, Smartphone, Mail, Plus, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  fixed: boolean; mobile: boolean; email: boolean; blacklist: boolean;
  onFixed: (v: boolean) => void; onMobile: (v: boolean) => void;
  onEmail: (v: boolean) => void; onBlacklist: (v: boolean) => void;
  onOpenBlacklist?: () => void;
}

export function ContactFilters({
  fixed, mobile, email,
  onFixed, onMobile, onEmail, onOpenBlacklist,
}: Props) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <Chip icon={<Phone className="h-4 w-4" />} label={t("contacts.fixed")} active={fixed} onToggle={() => onFixed(!fixed)} />
        <Chip icon={<Smartphone className="h-4 w-4" />} label={t("contacts.mobile")} active={mobile} onToggle={() => onMobile(!mobile)} />
        <Chip icon={<Mail className="h-4 w-4" />} label={t("contacts.email")} active={email} onToggle={() => onEmail(!email)} />
      </div>

      {/* Mandatory Blacklist Shield Banner & Action Button */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5 shadow-[0_0_25px_rgba(16,185,129,0.1)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span>{t("contacts.blacklist.title" as any) || "Filtro Blacklist & Privacy GDPR"}</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider text-emerald-400 border border-emerald-500/30">{t("contacts.blacklist.badge" as any) || "OBBLIGATORIO"}</span>
            </div>
            <div className="text-xs text-zinc-400">
              {t("contacts.blacklist.desc" as any) || "Il blocco dei contatti in blacklist è sempre attivo su tutti i database per conformità di legge."}
            </div>
          </div>
        </div>
        {onOpenBlacklist && (
          <button
            type="button"
            onClick={onOpenBlacklist}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("contacts.blacklist.btn" as any) || "Gestione Blacklist"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  icon, label, active, onToggle,
}: { icon: React.ReactNode; label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "glass flex items-center gap-3 rounded-xl p-3 text-left transition-all",
        "hover:bg-white/[0.06]",
        active && "border-cyan/40 shadow-[0_0_0_1px_var(--accent-cyan)]",
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        active ? "bg-cyan/20 text-cyan" : "bg-white/5 text-muted-foreground",
      )}>
        {icon}
      </div>
      <span className="text-sm">{label}</span>
    </button>
  );
}
