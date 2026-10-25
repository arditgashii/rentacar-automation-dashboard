import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RegressionView } from "@/components/regression/regression-view";
import { SkeletonRows } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/guards";
import { canWrite } from "@/lib/auth/permissions";
import { KINDS, type RegressionKind } from "@/lib/regression/library";

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind: key } = await params;
  const kind = KINDS.find((k) => k.key === key);
  return { title: kind?.label ?? "Manual Regression" };
}

export default async function RegressionKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await requirePage("regression", `/regression/${encodeURIComponent(kind)}`);
  if (!KINDS.some((k) => k.key === kind)) notFound();
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <RegressionView kind={kind as RegressionKind} canWrite={canWrite(user.role, "regression")} />
      </Suspense>
    </div>
  );
}
