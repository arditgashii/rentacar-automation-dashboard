import type { Metadata } from "next";

import { SuiteEditor } from "@/components/automation/suite-editor";

export const metadata: Metadata = { title: "Suite" };

export default async function SuitePage({ params }: { params: Promise<{ suiteId: string }> }) {
  const { suiteId } = await params;
  return <SuiteEditor key={suiteId} suiteId={suiteId === "new" ? null : suiteId} />;
}
