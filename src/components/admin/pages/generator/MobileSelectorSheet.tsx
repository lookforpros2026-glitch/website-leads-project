"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

export default function MobileSelectorSheet({
  open,
  onOpenChange,
  title,
  searchSlot,
  children,
  onClear,
  onLoadMore,
  hasMore,
  onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  searchSlot?: ReactNode;
  children: ReactNode;
  onClear?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onDone: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} aria-label="Close sheet" />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-slate-800 bg-slate-950 pb-6">
        <div className="px-4 pt-3 pb-2">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/20" />
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm font-semibold">{title}</div>
            <button onClick={() => onOpenChange(false)} className="h-9 w-9 rounded-xl border border-slate-700 text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {searchSlot && <div className="px-4 pb-2 sticky top-0 bg-slate-950">{searchSlot}</div>}
        <div className="max-h-[65vh] overflow-auto px-4 pb-2 space-y-2">{children}</div>
        <div className="px-4 pt-2 flex items-center gap-2">
          {onClear && (
            <button
              onClick={onClear}
              className="h-11 rounded-lg border border-slate-700 px-3 text-xs text-slate-300"
            >
              Clear
            </button>
          )}
          {hasMore && onLoadMore && (
            <button onClick={onLoadMore} className="h-11 rounded-lg border border-slate-700 px-3 text-xs text-slate-300">
              Load more
            </button>
          )}
          <button
            onClick={onDone}
            className="ml-auto h-11 rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
