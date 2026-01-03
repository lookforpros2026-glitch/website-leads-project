"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import AdminNav from "./AdminNav";

export default function MobileAdminNav({ title = "Admin Studio" }: { title?: string }) {
  const [open, setOpen] = useState(false);
  const portalTarget = useMemo(() => (typeof document !== "undefined" ? document.body : null), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="h-10 w-10 rounded-xl border border-white/10 text-white/80 flex items-center justify-center"
          aria-label="Open navigation"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Admin navigation">
              <button className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Close navigation" />
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t border-white/10 bg-slate-950 pb-6 shadow-xl">
                <div className="px-4 pt-3 pb-2">
                  <div className="mx-auto h-1 w-12 rounded-full bg-white/20" />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/90">{title}</div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="h-9 w-9 rounded-xl border border-white/10 text-white/80 flex items-center justify-center"
                      aria-label="Close navigation"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[72vh] overflow-auto px-3">
                  <AdminNav onNavigate={() => setOpen(false)} />
                </div>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </div>
  );
}
