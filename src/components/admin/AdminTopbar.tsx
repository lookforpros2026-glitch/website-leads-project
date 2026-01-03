"use client";

import { Search, UserCircle2 } from "lucide-react";

export default function AdminTopbar({ adminEmail, envWarnings }: { adminEmail: string; envWarnings: string[] }) {
  return (
    <div className="hidden md:block sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="font-semibold text-white/90">Admin Studio</div>
        <div className="relative flex-1 max-w-xl">
          <Search className="h-4 w-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="w-full h-10 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/40"
            placeholder="Search pages, cities, services..."
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <UserCircle2 className="h-6 w-6 text-white/40" />
          <span>{adminEmail}</span>
        </div>
      </div>
      {envWarnings.length > 0 && (
        <div className="px-4 py-2 text-xs text-amber-200 bg-amber-500/10 border-t border-amber-500/20">
          {envWarnings.join(" | ")}
        </div>
      )}
    </div>
  );
}
