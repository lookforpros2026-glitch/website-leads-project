import { ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { requireAdminEnv } from "@/lib/env";

requireAdminEnv();

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><AdminGate>{children}</AdminGate></div>;
}
