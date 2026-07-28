export type ExportCellValue = string | number | boolean | Date | null | undefined;

export interface ExportColumn<TData> {
  header: string;
  value: (record: TData) => ExportCellValue;
}

export interface ExportDefinition<TData> {
  columns: ExportColumn<TData>[];
  fileName: string;
  sheetName: string;
}
