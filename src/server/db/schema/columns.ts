import { randomUUID } from "node:crypto";

import { customType, timestamp, varchar } from "drizzle-orm/mysql-core";

/** A primary key that generates its own UUID. */
export const idColumn = (name = "id") =>
  varchar(name, { length: 36 }).$defaultFn(() => randomUUID());

/** A column that points at another row's id. It must never invent a value of its own. */
export const referenceColumn = (name: string) => varchar(name, { length: 36 });

export const createdAtColumn = () => timestamp("created_at").notNull().defaultNow();
export const updatedAtColumn = () => timestamp("updated_at").notNull().defaultNow().onUpdateNow();

/**
 * MariaDB stores JSON as LONGTEXT, so the driver hands back strings that Drizzle's own `json()`
 * never parses. This column writes and reads real JSON values on both MariaDB and MySQL.
 */
export const jsonColumn = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType: () => "json",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? (JSON.parse(value) as TData) : (value as TData)),
  })(name);
