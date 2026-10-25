import type { Metadata } from "next";
import { Suspense } from "react";

import { TestPlansView } from "@/components/test-plans/test-plans-view";
import { SkeletonRows } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Test Plans" };

export default async function TestPlansPage() {
  await requirePage("testPlans", "/test-plans");
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <TestPlansView />
      </Suspense>
    </div>
  );
}
