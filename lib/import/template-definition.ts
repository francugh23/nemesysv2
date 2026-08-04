import type {
  ImportTemplateDefinition,
  ImportTemplateField,
} from "@/types/import-template";

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getImportFieldByHeader(
  definition: ImportTemplateDefinition,
  header: string,
): ImportTemplateField | undefined {
  const normalizedHeader = normalizeHeader(header);

  return definition.importWorksheet.fields.find((field) =>
    [field.canonicalHeader, ...field.aliases].some(
      (alias) => normalizeHeader(alias) === normalizedHeader,
    ),
  );
}

export function getImportFieldKeyByHeader(
  definition: ImportTemplateDefinition,
  header: string,
) {
  return getImportFieldByHeader(definition, header)?.key;
}

export function getRequiredImportFieldKeys(
  definition: ImportTemplateDefinition,
) {
  return definition.importWorksheet.fields
    .filter((field) => field.required)
    .map((field) => field.key);
}
