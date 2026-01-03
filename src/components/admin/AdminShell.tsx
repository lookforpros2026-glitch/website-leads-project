import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { getSessionAdmin } from "@/lib/auth.app.server";
import { getEnvWarnings } from "@/lib/env";
import { AdminSWRProvider } from "./AdminSWRProvider";
import MobileAdminNav from "./nav/MobileAdminNav";

export default async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await getSessionAdmin();
  if (!admin) {
    return (
      <div className="admin-theme min-h-screen bg-slate-950 flex items-center justify-center text-white/90">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
          <div className="text-lg font-semibold">Not authorized</div>
          <p className="text-sm text-white/60 mt-2">Please log in as an admin.</p>
          <a href="/admin/login" className="mt-3 inline-flex h-10 items-center px-4 rounded-xl bg-emerald-400 text-slate-900 text-sm font-semibold">
            Go to login
          </a>
        </div>
      </div>
    );
  }
  const envWarnings = getEnvWarnings();
  return (
    <div className="admin-theme h-[100dvh] overflow-hidden bg-slate-950 text-white/90">
      <MobileAdminNav />
      <div className="flex h-full min-h-0">
        <AdminSidebar />
        <AdminSWRProvider>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="min-h-0 flex flex-col">
              <AdminTopbar adminEmail={admin.email || ""} envWarnings={envWarnings} />
              <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
            </div>
          </main>
        </AdminSWRProvider>
      </div>
    </div>
  );
}
