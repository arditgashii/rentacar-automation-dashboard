import { cancelQueued } from "@/lib/automation/queue";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/** Cancel all: empties the queue. The running run is not touched. */
export const DELETE = route(async () => {
  await requireApi("automation", "write");
  return json({ cancelled: await cancelQueued(db) });
});
