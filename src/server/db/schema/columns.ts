import { randomUUID } from "node:crypto";

import { timestamp, varchar } from "drizzle-orm/mysql-core";

export const idColumn = (name = "id") =>
  varchar(name, { length: 36 }).$defaultFn(() => randomUUID());

export const createdAtColumn = () => timestamp("created_at").notNull().defaultNow();
export const updatedAtColumn = () => timestamp("updated_at").notNull().defaultNow().onUpdateNow();
