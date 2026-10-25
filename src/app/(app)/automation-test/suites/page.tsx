import type { Metadata } from "next";

import { AutomationHeader } from "@/components/automation/header";
import { SuitesView } from "@/components/automation/suites-view";

export const metadata: Metadata = { title: "Suites" };

export default function SuitesPage() {
  return (
    <>
      <AutomationHeader tab="suites" title="Suites" crumbs={[{ label: "Suites" }]} />
      <SuitesView />
    </>
  );
}
