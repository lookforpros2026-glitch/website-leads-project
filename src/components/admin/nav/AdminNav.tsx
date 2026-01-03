"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutGrid,
  PlusCircle,
  LayoutTemplate,
  Calculator,
  Users,
  Settings,
} from "lucide-react";

export const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/gallery", label: "Gallery", icon: LayoutGrid },
  { href: "/admin/pages/generate", label: "Generate pages", icon: PlusCircle },
  { href: "/admin/template", label: "Template", icon: LayoutTemplate },
  { href: "/admin/estimator", label: "Estimator", icon: Calculator },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-1 text-sm">
      {adminLinks.map((link) => {
        const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              active ? "bg-white/10 text-white border-white/20" : "bg-transparent border-transparent text-white/70 hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
