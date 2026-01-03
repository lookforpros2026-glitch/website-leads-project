export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { requireAdminEnv } from "@/lib/env";

export default function AdminLayout({ children }: { children: ReactNode }) {
  requireAdminEnv();
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><AdminGate>{children}</AdminGate></div>;
}
