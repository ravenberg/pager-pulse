/**
 * RFC 4180 CSV. A cell that starts like a formula gets a leading quote, so a
 * title such as `=HYPERLINK(...)` stays text in a spreadsheet.
 */
export function toCsv(rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
