import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  children: ReactNode;
}

export function GlassCard({ strong, className, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "relative overflow-hidden p-5 transition-all duration-500",
        "hover:brightness-105",
        className,
      )}
      {...rest}
    >
      <div className="theme-card-overlay pointer-events-none absolute inset-0 z-0 transition-opacity duration-500" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
