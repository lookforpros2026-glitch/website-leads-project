export default function EstimatorBlockPreview() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">Estimator</div>
          <div className="mt-1 text-xs text-slate-400">
            This is a preview placeholder. The real estimator runs on the live page.
          </div>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
          Preview
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-11 rounded-xl border border-slate-800 bg-slate-900/40" />
        <div className="h-11 rounded-xl border border-slate-800 bg-slate-900/40" />
        <div className="h-11 rounded-xl border border-slate-800 bg-slate-900/40" />
        <div className="h-11 rounded-xl border border-slate-800 bg-slate-900/40" />
      </div>

      <div className="mt-4 flex justify-end">
        <div className="h-11 w-32 rounded-xl border border-slate-700 bg-slate-900/60" />
      </div>
    </section>
  );
}
