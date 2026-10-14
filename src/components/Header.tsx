"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, ShieldCheck, FlaskConical } from "lucide-react";
import { Avatar, cn } from "./ui";

const NAV = [
  { href: "/", label: "Exchange QA", match: (p: string) => p === "/" || p.startsWith("/ep") },
  { href: "/audit", label: "Audit", match: (p: string) => p.startsWith("/audit") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export default function Header({ user, demo }: { user: { name: string; email: string } | null; demo: boolean }) {
  const path = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><ShieldCheck size={18} /></span>
            <span className="hidden sm:inline">oGX QA Hub</span>
          </Link>
          <nav className="flex gap-1" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={n.match(path) ? "page" : undefined}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", n.match(path) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{n.label}</Link>
            ))}
          </nav>
          {demo && <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 md:inline-flex"><FlaskConical size={12} />Demo data</span>}
        </div>
        {user && !demo && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight md:block">
              <div className="font-medium text-slate-700">{user.name}</div>
              <div className="text-slate-400">{user.email}</div>
            </div>
            <Avatar name={user.name || user.email} size={30} />
            <button onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><LogOut size={16} /></button>
          </div>
        )}
      </div>
    </header>
  );
}
