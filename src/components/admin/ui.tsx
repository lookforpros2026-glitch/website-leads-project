import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-white/10 bg-white/5 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <CardShell className="p-4 space-y-1">
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-2xl font-semibold text-white/90">{value}</div>
      {hint && <div className="text-xs text-white/60">{hint}</div>}
    </CardShell>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "h-10 px-4 rounded-xl bg-emerald-400 text-slate-900 text-sm font-semibold hover:bg-emerald-300 transition border border-emerald-300/60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function GhostButton({ className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 h-10 text-sm font-medium",
        "border border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:text-white transition",
        className
      )}
    />
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/30"
      : tone === "warning"
      ? "bg-amber-400/15 text-amber-200 border-amber-400/30"
      : tone === "danger"
      ? "bg-rose-400/15 text-rose-200 border-rose-400/30"
      : "bg-white/10 text-white/80 border-white/15";
  return <span className={cn("px-2 py-0.5 rounded-full text-xs border", toneClass)}>{children}</span>;
}

export function SectionTitle({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div>
        {desc && <div className="text-white/60 text-sm">{desc}</div>}
        <h2 className="text-xl font-semibold text-white/90">{title}</h2>
      </div>
      {actions}
    </div>
  );
}

export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return <CardShell className={cn("p-4", className)}>{children}</CardShell>;
}

export function SecondaryButton({ children, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/80 text-sm font-semibold hover:border-white/30",
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn("h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:border-white/30", className)}
    >
      {children}
    </button>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-7 items-center rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-white/80", className)}>{children}</span>;
}

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/90 placeholder:text-white/40",
        className
      )}
    />
  );
}
