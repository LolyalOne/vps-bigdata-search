import { useQuery } from "@tanstack/react-query";
import { Check, Globe2, Database } from "lucide-react";
import { fetchTables } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("it-IT").format(n);
}

export function TableSelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const { t, lang } = useT();
  const { data, isLoading } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      <Card
        active={value === "global"}
        onClick={() => onChange("global")}
        icon={<Globe2 className="h-4 w-4" />}
        title={t("table.global")}
        subtitle={t("table.global.desc")}
        badge="34.2M"
        accent="violet"
      />
      {isLoading && Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-[86px] rounded-xl" />
      ))}
      {data?.map((tbl) => (
        <Card
          key={tbl.id}
          active={value === tbl.id}
          onClick={() => onChange(tbl.id)}
          icon={<Database className="h-4 w-4" />}
          title={tbl.label[lang]}
          subtitle={tbl.description[lang]}
          badge={fmt(tbl.rowCount)}
        />
      ))}
    </div>
  );
}

function Card({
  active, onClick, icon, title, subtitle, badge, accent = "cyan",
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  title: string; subtitle: string; badge: string;
  accent?: "cyan" | "violet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group glass relative flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-all duration-300",
        "hover:-translate-y-0.5 hover:bg-white/[0.06]",
        active && (accent === "violet"
          ? "border-violet/50 shadow-[0_0_0_1px_var(--accent-violet),0_10px_30px_-10px_var(--accent-violet)]"
          : "border-cyan/50 shadow-[0_0_0_1px_var(--accent-cyan),0_10px_30px_-10px_var(--accent-cyan)]"),
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className={cn("rounded-md p-1", accent === "violet" ? "text-violet" : "text-cyan")}>{icon}</span>
        {active && <Check className="h-4 w-4 text-emerald" />}
      </div>
      <div className="text-sm font-semibold leading-tight text-foreground line-clamp-1">{title}</div>
      <div className="text-[11px] leading-tight text-muted-foreground line-clamp-2">{subtitle}</div>
      <div className="mt-1 text-[10px] font-mono text-muted-foreground/80">{badge}</div>
    </button>
  );
}
