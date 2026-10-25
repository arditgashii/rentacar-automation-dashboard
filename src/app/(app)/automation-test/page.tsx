import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AutomationHeader } from "@/components/automation/header";
import { OverviewView } from "@/components/automation/overview-view";

export const metadata: Metadata = { title: "Automation Tests" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  // Links from the first version of the dashboard used ?view=scheduled for the schedules list.
  if ((await searchParams).view === "scheduled") redirect("/automation-test/schedules");
  return (
    <>
      <AutomationHeader tab="overview" title="Overview" crumbs={[{ label: "Overview" }]} />
      <OverviewView />
    </>
  );
}
