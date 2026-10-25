"use client";

import { ClipboardList, FlaskConical, ListChecks, LogOut, Menu, Settings, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: React.ElementType; match: string; children?: { href: string; label: string }[] };

function navFor(role: Role): { main: NavItem[]; bottom: NavItem[] } {
  const automation: NavItem = {
    href: "/automation-test",
    label: "Automation Tests",
    icon: FlaskConical,
    match: "/automation-test",
    children: [
      { href: "/automation-test", label: "Overview" },
      { href: "/automation-test/runs", label: "Runs" },
      { href: "/automation-test/schedules", label: "Schedules" },
      { href: "/automation-test/suites", label: "Suites" },
    ],
  };
  const main: NavItem[] = [
    ...(role === "admin" ? [automation] : []),
    { href: "/test-plans", label: "Test Plans", icon: ClipboardList, match: "/test-plans" },
    { href: "/regression", label: "Manual Regression", icon: ListChecks, match: "/regression" },
  ];
  const bottom: NavItem[] =
    role === "admin"
      ? [
          { href: "/automation-test/settings", label: "Settings", icon: Settings, match: "/automation-test/settings" },
          { href: "/members", label: "Members", icon: Users, match: "/members" },
        ]
      : [];
  return { main, bottom };
}

function isActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`);
}

export function Sidebar({ user }: { user: { name: string; email: string; role: Role } }) {
  const pathname = usePathname();
  const router = useRouter();
  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const { main, bottom } = navFor(user.role);


  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-accent text-xs font-bold text-white">D</span>
          <span>
            DriveNow <span className="font-normal text-muted">QA Hub</span>
          </span>
        </Link>
        <button className="rounded-md p-1.5 text-muted hover:bg-hover lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main">
        {main.map((item) => {
          const active = isActive(pathname, item.match) && !bottom.some((b) => isActive(pathname, b.match));
          return (
            <div key={item.href} className="mb-0.5">
              <Link
                href={item.href}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-base",
                  active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
              {item.children && active ? (
                <div className="mt-0.5 mb-1 ml-[18px] flex flex-col border-l border-line pl-3">
                  {item.children.map((child) => {
                    const childActive =
                      child.href === item.href ? pathname === child.href : isActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex h-7 items-center text-sm",
                          childActive ? "font-medium text-ink" : "text-muted hover:text-ink",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line px-2 py-2">
        {bottom.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-base",
              isActive(pathname, item.match) ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        ))}
        <div className="mt-2 flex items-center gap-2 rounded-md px-2.5 py-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-xs font-semibold text-muted">
            {user.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={user.name}>
              {user.name}
            </p>
            <p className="truncate text-xs text-muted" title={user.email}>
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Log out" title="Log out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button className="-ml-1.5 rounded-md p-1.5 hover:bg-hover" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">DriveNow QA Hub</span>
      </div>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-line bg-surface lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-[var(--shadow-pop)]">{nav}</aside>
        </div>
      ) : null}
    </>
  );
}
