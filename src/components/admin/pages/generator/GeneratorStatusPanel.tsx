"use client";

export default function GeneratorStatusPanel({
  selectedPlaces,
  selectedServices,
  totalPages,
  estimatedSeconds,
  jobStatus,
  selectAllProgress,
}: {
  selectedPlaces: number;
  selectedServices: number;
  totalPages: number;
  estimatedSeconds: number;
  jobStatus: { status?: string; completed?: number; total?: number } | null;
  selectAllProgress?: { running: boolean; done: number; total: number } | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          Places: {selectedPlaces}
          {selectAllProgress?.running ? (
            <span className="ml-2 text-[11px] text-slate-400">
              ({selectAllProgress.done}/{selectAllProgress.total})
            </span>
          ) : null}
        </div>
        <div>Services: {selectedServices}</div>
        <div>Pages: {totalPages}</div>
        <div>Est: {Math.ceil(estimatedSeconds)}s</div>
        {jobStatus && (
          <div className="ml-auto">
            Status: {jobStatus.status} ({jobStatus.completed}/{jobStatus.total})
          </div>
        )}
      </div>
    </div>
  );
}
