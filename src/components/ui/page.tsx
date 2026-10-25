import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumbs" className="flex min-w-0 items-center gap-1 text-sm text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-faint" /> : null}
          {item.href ? (
            <Link href={item.href} className="truncate hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-ink" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  crumbs,
  title,
  actions,
  children,
}: {
  crumbs: Crumb[];
  title: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-5">
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** Pill tabs that are links, so every tab has its own URL and Back/Forward work. */
export function PillTabs({
  tabs,
  active,
  className,
}: {
  tabs: { label: string; href: string; key: string; count?: number }[];
  active: string;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-wrap gap-1", className)} aria-label="Sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
            tab.key === active ? "bg-ink text-white" : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={cn("tabular text-xs", tab.key === active ? "text-white/70" : "text-faint")}>{tab.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
