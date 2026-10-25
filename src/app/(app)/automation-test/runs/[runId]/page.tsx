import type { Metadata } from "next";
import { Suspense } from "react";

import { RunDetails } from "@/components/automation/run-details";

export const metadata: Metadata = { title: "Run details" };

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return (
    <Suspense>
      <RunDetails runId={runId} />
    </Suspense>
  );
}
