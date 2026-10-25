import type { Metadata } from "next";

import { AutomationHeader } from "@/components/automation/header";
import { SettingsView } from "@/components/automation/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <AutomationHeader tab="settings" title="Settings" crumbs={[{ label: "Settings" }]} />
      <SettingsView />
    </>
  );
}
