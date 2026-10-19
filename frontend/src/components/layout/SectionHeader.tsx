import type { ReactNode } from "react";
import { HelpTooltip } from "./HelpTooltip";

export function SectionHeader({
  title, help, right,
}: { title: string; help: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <HelpTooltip text={help} />
      </div>
      {right}
    </div>
  );
}
