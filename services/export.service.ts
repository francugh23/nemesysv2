import { createCsv, CSV_MIME_TYPE } from "@/lib/export/csv";
import { createExportFileName } from "@/lib/export/format";
import { createXlsx, XLSX_MIME_TYPE } from "@/lib/export/xlsx";
import type {
  DownloadableFile,
  ExportCellValue,
  ExportDefinition,
  ExportFormat,
} from "@/types/export";

export const EXPORT_BATCH_SIZE = 1_000;
export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const EXPORT_MAX_CELL_BYTES = 1024 * 1024;

export class ExportError extends Error {}

function assertRowWidth(rows: ExportCellValue[][], columnCount: number) {
  if (rows.some((row) => row.length !== columnCount)) {
    throw new ExportError("The export projection does not match its columns.");
  }
}

function getCellByteLength(value: ExportCellValue) {
  if (value === null || value === undefined) return 0;

  return Buffer.byteLength(
    value instanceof Date ? value.toISOString() : String(value),
    "utf8",
  );
}

export async function generateExport<TQuery, TProjection>(
  query: TQuery,
  format: ExportFormat,
  definition: ExportDefinition<TQuery, TProjection>,
): Promise<DownloadableFile> {
  const rowCount = await definition.count(query);

  if (rowCount === 0) {
    throw new ExportError("No matching records are available to export.");
  }

  if (rowCount > EXPORT_MAX_ROWS) {
    throw new ExportError(
      `Exports are limited to ${EXPORT_MAX_ROWS.toLocaleString("en-US")} records. Narrow the current filters and try again.`,
    );
  }

  const rows: ExportCellValue[][] = [];
  let projectedBytes = definition.columns.reduce(
    (total, column) => total + Buffer.byteLength(column.header, "utf8"),
    0,
  );

  for (let skip = 0; skip < rowCount; skip += EXPORT_BATCH_SIZE) {
    const records = await definition.loadBatch(query, {
      skip,
      take: Math.min(EXPORT_BATCH_SIZE, rowCount - skip),
    });

    for (const record of records) {
      const row = definition.mapProjection(record);

      if (row.some((cell) => getCellByteLength(cell) > EXPORT_MAX_CELL_BYTES)) {
        throw new ExportError(
          "The export contains a value that is too large to process.",
        );
      }

      for (const cell of row) {
        projectedBytes += getCellByteLength(cell);
      }

      if (projectedBytes > EXPORT_MAX_FILE_BYTES) {
        throw new ExportError(
          "The export is too large to process. Narrow the current filters and try again.",
        );
      }

      rows.push(row);
    }
  }

  if (rows.length !== rowCount) {
    throw new ExportError(
      "Records changed while the export was being prepared. Try again.",
    );
  }

  assertRowWidth(rows, definition.columns.length);

  const contentBase64 =
    format === "csv"
      ? Buffer.from(createCsv(definition.columns, rows), "utf8").toString(
          "base64",
        )
      : createXlsx(definition.sheetName, definition.columns, rows);
  const fileSize = Buffer.byteLength(contentBase64, "base64");

  if (fileSize > EXPORT_MAX_FILE_BYTES) {
    throw new ExportError(
      "The generated export is too large. Narrow the current filters and try again.",
    );
  }

  return {
    fileName: createExportFileName(definition.fileSlug, format),
    mimeType: format === "csv" ? CSV_MIME_TYPE : XLSX_MIME_TYPE,
    contentBase64,
    rowCount,
  };
}
