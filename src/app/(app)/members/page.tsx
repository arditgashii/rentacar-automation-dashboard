import type { Metadata } from "next";

import { MembersView } from "@/components/members/members-view";
import { requirePage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  await requirePage("members", "/members");
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <MembersView />
    </div>
  );
}
