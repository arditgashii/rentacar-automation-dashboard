import type { Metadata } from "next";

import { AutomationHeader } from "@/components/automation/header";
import { SchedulesView } from "@/components/automation/schedules-view";

export const metadata: Metadata = { title: "Schedules" };

export default function SchedulesPage() {
  return (
    <>
      <AutomationHeader tab="schedules" title="Schedules" crumbs={[{ label: "Schedules" }]} />
      <SchedulesView />
    </>
  );
}
