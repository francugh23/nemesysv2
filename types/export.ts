export type ExportCellValue = string | number | boolean | Date | null | undefined;

export type ExportFormat = "csv" | "xlsx";

export interface ExportColumn {
  header: string;
}

export interface ExportDefinition<TQuery, TProjection> {
  fileSlug: string;
  sheetName: string;
  columns: readonly ExportColumn[];
  count: (query: TQuery) => Promise<number>;
  loadBatch: (
    query: TQuery,
    pagination: { skip: number; take: number },
  ) => Promise<TProjection[]>;
  mapProjection: (record: TProjection) => ExportCellValue[];
}

export interface DownloadableFile {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  rowCount: number;
}

export type ExportActionResult =
  | { file: DownloadableFile; error?: never }
  | { file?: never; error: string };
