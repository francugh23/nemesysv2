import * as z from "zod";

export const ExportFormatSchema = z.enum(["csv", "xlsx"]);
