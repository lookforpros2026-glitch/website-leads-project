"use client";

import { ReactNode } from "react";

export default function SelectorCard({
  title,
  subtitle,
  count,
  actionLabel,
  onAction,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
        </div>
        {rightSlot}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Selected: {count}</span>
        <button
          onClick={onAction}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
