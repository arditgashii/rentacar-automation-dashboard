import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { canWrite } from "@/lib/auth/permissions";
import { loadWorkspace } from "@/lib/test-plans/data";

/** Projects, the tree and every test case (without the long fields) for the Test Plans page. */
export const GET = route(async () => {
  const user = await requireApi("testPlans");
  return json({ ...(await loadWorkspace()), canWrite: canWrite(user.role, "testPlans") });
});
