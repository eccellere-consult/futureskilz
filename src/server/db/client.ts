import "server-only";

import { drizzle } from "drizzle-orm/mysql2";

import { getMysqlPool } from "@/lib/mysql";
import * as schema from "@/server/db/schema";

export function createDatabase() {
  return drizzle({ client: getMysqlPool(), schema, mode: "default" });
}

export type Database = ReturnType<typeof createDatabase>;
