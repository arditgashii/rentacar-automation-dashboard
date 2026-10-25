import { AutomationProvider } from "@/components/automation/context";
import { NowPanel } from "@/components/automation/now-panel";
import { requirePage } from "@/lib/auth/guards";

export default async function AutomationLayout({ children }: { children: React.ReactNode }) {
  await requirePage("automation", "/automation-test");
  return (
    <AutomationProvider>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">{children}</main>
        <NowPanel />
      </div>
    </AutomationProvider>
  );
}
