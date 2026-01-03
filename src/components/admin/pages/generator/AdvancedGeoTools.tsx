"use client";

import { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function AdvancedGeoTools({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
      >
        <span>Advanced</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="border-t border-slate-800 px-4 py-4 space-y-4 text-xs text-slate-300">{children}</div>}
    </div>
  );
}
