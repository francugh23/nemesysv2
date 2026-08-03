import * as z from "zod";

export const AuditLogDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Invalid date.");

export const AuditLogIdSchema = z.string().cuid();

export const AuditLogSortFieldSchema = z.enum([
  "createdAt",
  "actor",
  "module",
  "action",
  "record",
  "description",
]);

export const AuditLogTableQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    module: z.string().trim().min(1).max(100).optional(),
    action: z.string().trim().min(1).max(100).optional(),
    actor: z.string().trim().min(1).optional(),
    dateFrom: AuditLogDateSchema.optional(),
    dateTo: AuditLogDateSchema.optional(),
    sort: AuditLogSortFieldSchema.optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { message: "The start date must not be after the end date.", path: ["dateTo"] },
  );

export function validateAuditLogTableQuery(query: unknown) {
  return AuditLogTableQuerySchema.safeParse(query);
}

export const AuditLogListItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  module: z.string(),
  recordId: z.string().nullable(),
  recordName: z.string().nullable(),
  description: z.string(),
  createdAt: z.date(),
  actorId: z.string(),
  actorFirstName: z.string(),
  actorMiddleName: z.string().nullable(),
  actorLastName: z.string(),
  actorUsername: z.string(),
  actorEmployeeNumber: z.string().nullable(),
});

export type AuditLogListItem = z.infer<typeof AuditLogListItemSchema>;
export type AuditLogTableQueryInput = z.input<typeof AuditLogTableQuerySchema>;
export type AuditLogTableQuery = z.output<typeof AuditLogTableQuerySchema>;

export const AuditLogDetailSchema = AuditLogListItemSchema.extend({
  metadata: z.unknown().nullable(),
});

export type AuditLogDetail = z.infer<typeof AuditLogDetailSchema>;

export interface AuditLogPage {
  items: AuditLogListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AuditLogFilterOptions {
  modules: string[];
  actions: string[];
  actors: Array<{
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    username: string;
  }>;
}
