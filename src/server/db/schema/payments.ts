import { bigint, boolean, datetime, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, idColumn, jsonColumn, referenceColumn, updatedAtColumn } from "./columns";
import { kcStatements } from "./capture";
import { users } from "./core";

/**
 * What FutureSkilz sells. A plan is a time-boxed pass: paying once opens every Skill Shot for `duration_days`. Prices are what the
 * learner pays, tax included, and are set by an admin: the platform ships none. Auto-renewing subscriptions are not built; a
 * learner buys another pass when one ends.
 */
export const plans = mysqlTable(
  "plans",
  {
    id: idColumn().primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 400 }).notNull().default(""),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    durationDays: int("duration_days").notNull(),
    active: boolean("active").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("plans_code_idx").on(table.code)],
);

/** One purchase attempt. The amount is fixed by the server when the order is made; the gateway only confirms it was paid. */
export const orders = mysqlTable(
  "orders",
  {
    id: idColumn().primaryKey(),
    userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    planId: referenceColumn("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    campaignId: referenceColumn("campaign_id"),
    listMinor: bigint("list_minor", { mode: "number" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    refundedMinor: bigint("refunded_minor", { mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: mysqlEnum("status", ["created", "paid", "failed", "refunded"]).notNull().default("created"),
    provider: varchar("provider", { length: 16 }).notNull(),
    providerOrderId: varchar("provider_order_id", { length: 80 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 80 }),
    customerState: varchar("customer_state", { length: 2 }).notNull(),
    customerGstin: varchar("customer_gstin", { length: 15 }),
    paidAt: datetime("paid_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("orders_provider_order_idx").on(table.provider, table.providerOrderId), index("orders_user_idx").on(table.userId, table.createdAt)],
);

/** A GST tax invoice, numbered consecutively within a financial year. The supplier's details are copied in, so an old invoice never changes. */
export const invoices = mysqlTable(
  "invoices",
  {
    id: idColumn().primaryKey(),
    orderId: referenceColumn("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    number: varchar("number", { length: 16 }).notNull(),
    financialYear: varchar("financial_year", { length: 5 }).notNull(),
    issuedAt: datetime("issued_at").notNull(),
    customerName: varchar("customer_name", { length: 160 }).notNull(),
    customerEmail: varchar("customer_email", { length: 254 }).notNull(),
    customerState: varchar("customer_state", { length: 2 }).notNull(),
    customerGstin: varchar("customer_gstin", { length: 15 }),
    description: varchar("description", { length: 240 }).notNull(),
    rateBp: int("rate_bp").notNull(),
    taxableMinor: bigint("taxable_minor", { mode: "number" }).notNull(),
    cgstMinor: bigint("cgst_minor", { mode: "number" }).notNull().default(0),
    sgstMinor: bigint("sgst_minor", { mode: "number" }).notNull().default(0),
    igstMinor: bigint("igst_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    supplier: jsonColumn<Record<string, string>>("supplier").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("invoices_order_idx").on(table.orderId), uniqueIndex("invoices_number_idx").on(table.number)],
);

/** A learner's right to every Skill Shot for a period. It ends by date; a refund revokes it. */
export const entitlements = mysqlTable(
  "entitlements",
  {
    id: idColumn().primaryKey(),
    userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orderId: referenceColumn("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    planId: referenceColumn("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    startsAt: datetime("starts_at").notNull(),
    endsAt: datetime("ends_at").notNull(),
    status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("entitlements_order_idx").on(table.orderId), index("entitlements_user_idx").on(table.userId, table.endsAt)],
);

/** Every gateway notification, by its own id, so a retried webhook is recognised and does nothing twice. */
export const paymentEvents = mysqlTable(
  "payment_events",
  {
    id: idColumn().primaryKey(),
    provider: varchar("provider", { length: 16 }).notNull(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    type: varchar("type", { length: 60 }).notNull(),
    outcome: varchar("outcome", { length: 120 }).notNull().default(""),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("payment_events_event_idx").on(table.provider, table.eventId)],
);

/** What a coach is owed for a final statement, and whether it has been paid. Bank details are never held here. */
export const payouts = mysqlTable(
  "payouts",
  {
    id: idColumn().primaryKey(),
    statementId: referenceColumn("statement_id").notNull().references(() => kcStatements.id, { onDelete: "restrict" }),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: mysqlEnum("status", ["queued", "paid", "failed"]).notNull().default("queued"),
    provider: varchar("provider", { length: 16 }).notNull().default("manual"),
    reference: varchar("reference", { length: 120 }),
    note: text("note"),
    createdBy: referenceColumn("created_by"),
    paidAt: datetime("paid_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("payouts_statement_idx").on(table.statementId), index("payouts_status_idx").on(table.status, table.createdAt)],
);
