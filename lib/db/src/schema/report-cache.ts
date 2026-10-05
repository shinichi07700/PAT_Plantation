import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportCacheTable = pgTable("report_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});
export const insertReportCacheSchema = createInsertSchema(reportCacheTable);
export type InsertReportCache = z.infer<typeof insertReportCacheSchema>;
export type ReportCache = typeof reportCacheTable.$inferSelect;