export function canonicalEmployeeNumber(value: string) {
  return value.trim().toUpperCase();
}

export function canonicalEmail(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
