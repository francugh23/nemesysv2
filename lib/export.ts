import * as XLSX from "xlsx";

import type { ExportDefinition } from "@/types/export";

export function exportToExcel<TData>(
  records: TData[],
  definition: ExportDefinition<TData>,
) {
  const rows = records.map((record) =>
    definition.columns.map((column) => column.value(record) ?? ""),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([
    definition.columns.map((column) => column.header),
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, definition.sheetName);
  XLSX.writeFile(workbook, definition.fileName, {
    bookType: "xlsx",
    compression: true,
  });
}
