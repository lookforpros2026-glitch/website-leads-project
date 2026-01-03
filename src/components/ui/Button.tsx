import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-md border text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4",
        variant === "primary" && "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        variant === "secondary" && "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
        variant === "ghost" && "border-transparent bg-transparent text-slate-900 hover:bg-slate-100",
        className
      )}
    />
  );
}
