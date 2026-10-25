import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shell/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { currentUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.role) redirect("/no-access");

  return (
    <TooltipProvider>
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <div className="lg:pl-60">{children}</div>
    </TooltipProvider>
  );
}
