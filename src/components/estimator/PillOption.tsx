import * as React from "react";

type Props = {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function PillOption({ label, sublabel, selected, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-12 w-full rounded-2xl px-4",
        "inline-flex items-center justify-between gap-3",
        "border transition",
        "text-sm font-semibold",
        selected
          ? "border-blue-400 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        className || "",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
      {sublabel ? <span className="shrink-0 text-xs font-medium text-slate-500">{sublabel}</span> : null}
    </button>
  );
}
