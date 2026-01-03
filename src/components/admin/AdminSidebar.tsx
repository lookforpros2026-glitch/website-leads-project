import { BadgeCheck } from "lucide-react";
import AdminNav from "./nav/AdminNav";

export default function AdminSidebar() {
  return (
    <aside className="hidden md:flex md:w-64 xl:w-72 flex-col border-r border-white/10 bg-slate-950 sticky top-0 h-[100dvh] overflow-hidden">
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/90 font-semibold">
          <BadgeCheck className="h-5 w-5 text-emerald-300" />
          Admin Studio
        </div>
        <div className="text-xs text-white/60">Programmatic SEO control</div>
      </div>
      <AdminNav />
    </aside>
  );
}
