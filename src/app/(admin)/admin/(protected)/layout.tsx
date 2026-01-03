import { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
