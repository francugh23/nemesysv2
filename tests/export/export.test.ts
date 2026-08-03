import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import { createCsv } from "../../lib/export/csv";
import {
  createExportFileName,
  formatExportDate,
  formatExportDateTime,
} from "../../lib/export/format";
import { createXlsx } from "../../lib/export/xlsx";
import {
  EXPORT_BATCH_SIZE,
  EXPORT_MAX_CELL_BYTES,
  EXPORT_MAX_ROWS,
  ExportError,
  generateExport,
} from "../../services/export.service";
import type { ExportDefinition } from "../../types/export";

test("CSV uses a BOM, CRLF, escaping, and formula neutralization", () => {
  const csv = createCsv(
    [{ header: "Value" }, { header: "Note" }],
    [["=2+2", 'Quoted, "value"\nnext line']],
  );

  assert.equal(
    csv,
    '\uFEFFValue,Note\r\n\'=2+2,"Quoted, ""value""\nnext line"',
  );
});

test("XLSX preserves column order and neutralizes formula-like text", () => {
  const contentBase64 = createXlsx(
    "Students",
    [{ header: "LRN" }, { header: "Name" }],
    [["001234567890", "@Student"]],
  );
  const workbook = XLSX.read(Buffer.from(contentBase64, "base64"));
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1 },
  );

  assert.deepEqual(rows, [
    ["LRN", "Name"],
    ["001234567890", "'@Student"],
  ]);
});

test("export dates and filenames use Philippine time", () => {
  const date = new Date("2026-08-03T06:30:12.000Z");

  assert.equal(formatExportDate(date), "2026-08-03");
  assert.equal(formatExportDateTime(date), "2026-08-03 14:30:12 PHT");
  assert.equal(
    createExportFileName("Student Records", "csv", date),
    "nemesys-student-records-20260803-143012-PHT.csv",
  );
});

test("shared export service retrieves records in bounded batches", async () => {
  const records = Array.from(
    { length: EXPORT_BATCH_SIZE + 1 },
    (_, index) => index + 1,
  );
  const batches: Array<{ skip: number; take: number }> = [];
  const definition: ExportDefinition<undefined, number> = {
    fileSlug: "records",
    sheetName: "Records",
    columns: [{ header: "Value" }],
    count: async () => records.length,
    loadBatch: async (_query, pagination) => {
      batches.push(pagination);
      return records.slice(
        pagination.skip,
        pagination.skip + pagination.take,
      );
    },
    mapProjection: (record) => [record],
  };

  const file = await generateExport(undefined, "csv", definition);

  assert.equal(file.rowCount, records.length);
  assert.deepEqual(batches, [
    { skip: 0, take: EXPORT_BATCH_SIZE },
    { skip: EXPORT_BATCH_SIZE, take: 1 },
  ]);
});

test("shared export service rejects oversized result sets before loading", async () => {
  let loaded = false;
  const definition: ExportDefinition<undefined, number> = {
    fileSlug: "records",
    sheetName: "Records",
    columns: [{ header: "Value" }],
    count: async () => EXPORT_MAX_ROWS + 1,
    loadBatch: async () => {
      loaded = true;
      return [];
    },
    mapProjection: (record) => [record],
  };

  await assert.rejects(
    generateExport(undefined, "csv", definition),
    ExportError,
  );
  assert.equal(loaded, false);
});

test("shared export service rejects oversized cells before file generation", async () => {
  const definition: ExportDefinition<undefined, string> = {
    fileSlug: "records",
    sheetName: "Records",
    columns: [{ header: "Value" }],
    count: async () => 1,
    loadBatch: async () => ["x".repeat(EXPORT_MAX_CELL_BYTES + 1)],
    mapProjection: (record) => [record],
  };

  await assert.rejects(
    generateExport(undefined, "xlsx", definition),
    ExportError,
  );
});
