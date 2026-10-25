import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { exportAll } from "@/lib/test-plans/data";

/** Everything (not the deleted items or attachments) as one JSON file. */
export const GET = route(async () => {
  await requireApi("testPlans");
  const file = await exportAll();
  const day = file.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="test-plans-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
