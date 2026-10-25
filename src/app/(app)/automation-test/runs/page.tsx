import type { Metadata } from "next";
import { Suspense } from "react";

import { AutomationHeader } from "@/components/automation/header";
import { RunsView } from "@/components/automation/runs-view";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage() {
  return (
    <>
      <AutomationHeader tab="runs" title="Runs" crumbs={[{ label: "Runs" }]} />
      <Suspense>
        <RunsView />
      </Suspense>
    </>
  );
}
