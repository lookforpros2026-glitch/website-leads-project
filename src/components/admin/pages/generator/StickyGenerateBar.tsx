"use client";

import { ReactNode } from "react";

export default function StickyGenerateBar({
  publishOnCreate,
  onTogglePublish,
  maxPages,
  onMaxPagesChange,
  onGenerate,
  onCancel,
  generateDisabled,
  helperText,
  jobStatus,
  progressPct,
  elapsedDisplay,
  etaDisplay,
  isMobile,
}: {
  publishOnCreate: boolean;
  onTogglePublish: (next: boolean) => void;
  maxPages: string;
  onMaxPagesChange: (value: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  generateDisabled: boolean;
  helperText?: ReactNode;
  jobStatus: {
    status?: string;
    total?: number;
    completed?: number;
    currentOperation?: string | null;
    errorMessage?: string | null;
    canceled?: boolean;
  } | null;
  progressPct: number;
  elapsedDisplay: string | null;
  etaDisplay: string | null;
  isMobile: boolean;
}) {
  return (
    <div
      className={
        isMobile
          ? "fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+16px)]"
          : "sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 px-6 py-3"
      }
    >
      {helperText && <div className="mb-2 text-xs text-rose-300">{helperText}</div>}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={publishOnCreate} onChange={(e) => onTogglePublish(e.target.checked)} />
          Publish
        </label>
        <label className="flex items-center gap-2">
          Max pages
          <input
            value={maxPages}
            onChange={(e) => onMaxPagesChange(e.target.value)}
            className="h-11 w-20 rounded-md border border-slate-700 bg-slate-950 px-2"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={generateDisabled}
            className="h-11 rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Generate
          </button>
          <button
            onClick={onCancel}
            className="h-11 rounded-lg border border-slate-700 px-3 text-xs text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>

      {jobStatus && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span>Status: {jobStatus.status}</span>
            <span>
              {jobStatus.completed}/{jobStatus.total}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-400" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {elapsedDisplay != null && <span>Elapsed: {elapsedDisplay}</span>}
            {etaDisplay != null && <span>ETA: {etaDisplay}</span>}
            {jobStatus.currentOperation && <span>Now: {jobStatus.currentOperation}</span>}
            {jobStatus.errorMessage && <span className="text-rose-300">{jobStatus.errorMessage}</span>}
            {jobStatus.canceled && <span className="text-amber-300">Canceled</span>}
          </div>
        </div>
      )}
    </div>
  );
}
