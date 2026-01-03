import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPanel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-800 bg-slate-950/40 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
            {title && <div className="text-lg font-semibold text-slate-100">{title}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
