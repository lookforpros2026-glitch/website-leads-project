"use client";

import { ReactNode } from "react";

export default function GeneratorShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {header}
      {children}
    </div>
  );
}
