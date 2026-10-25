import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

// One pool per process; Next.js dev reloads modules, so the pool is kept on globalThis.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString: env.databaseUrl, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
