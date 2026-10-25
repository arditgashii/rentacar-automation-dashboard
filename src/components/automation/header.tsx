"use client";

import { Plus, Settings } from "lucide-react";
import Link from "next/link";

import { Button, buttonClass } from "@/components/ui/button";
import { type Crumb, PageHeader, PillTabs } from "@/components/ui/page";
import { Tooltip } from "@/components/ui/tooltip";
import { useAutomation } from "./context";

const TABS = [
  { key: "overview", label: "Overview", href: "/automation-test" },
  { key: "runs", label: "Runs", href: "/automation-test/runs" },
  { key: "schedules", label: "Schedules", href: "/automation-test/schedules" },
  { key: "suites", label: "Suites", href: "/automation-test/suites" },
];

export function AutomationHeader({
  tab,
  title,
  crumbs,
  actions,
}: {
  tab: "overview" | "runs" | "schedules" | "suites" | "settings" | null;
  title: React.ReactNode;
  crumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  const { openNewRun, now } = useAutomation();
  return (
    <>
      {now && !now.workerAlive ? (
        <p role="status" className="mb-4 rounded-md border border-flaky/30 bg-flaky-soft px-3 py-2 text-sm text-flaky">
          The worker is not running, so queued runs and schedules wait. Start it with <code className="font-mono">npm run worker</code>.
        </p>
      ) : null}
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Automation Tests", href: "/automation-test" }, ...crumbs]}
        title={title}
        actions={
          <>
            {actions}
            {tab === "settings" ? null : (
              <Tooltip content="Settings">
                <Link href="/automation-test/settings" aria-label="Settings" className={buttonClass({ icon: true })}>
                  <Settings className="size-4" />
                </Link>
              </Tooltip>
            )}
            <Button variant="primary" onClick={() => openNewRun()} data-testid="new-run">
              <Plus className="size-4" aria-hidden /> New run
            </Button>
          </>
        }
      >
        {tab && tab !== "settings" ? <PillTabs tabs={TABS} active={tab} /> : null}
      </PageHeader>
    </>
  );
}
