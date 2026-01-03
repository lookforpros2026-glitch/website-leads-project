import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminRowInteractive } from "@/lib/ui/adminRow";

export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40", className)}>
      {children}
    </div>
  );
}

export function AdminTableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid border-b border-slate-800 bg-slate-950/80 px-4 py-2 text-xs font-medium text-slate-400", className)}>
      {children}
    </div>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-slate-800">{children}</div>;
}

export function AdminRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base = cn(
    "grid w-full items-center px-4 py-3 text-left text-sm rounded-xl border border-slate-800 bg-slate-900/30",
    adminRowInteractive,
    "focus:outline-none focus:ring-2 focus:ring-slate-500/40",
    className
  );
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={base}
    >
      {children}
    </div>
  );
}
