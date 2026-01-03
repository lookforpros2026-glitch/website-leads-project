import React from "react";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900",
        "focus:outline-none focus:ring-2 focus:ring-slate-200",
        className
      )}
    />
  );
}
