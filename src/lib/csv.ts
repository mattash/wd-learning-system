export function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
