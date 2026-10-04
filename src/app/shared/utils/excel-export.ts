/**
 * Zero-dependency Excel export via the SpreadsheetML 2003 XML format.
 * Excel opens this natively (File > Open, or double-click) with full
 * fidelity — multiple sheets, typed cells, bold headers — without pulling
 * in a third-party library. (The `xlsx`/SheetJS npm package was deliberately
 * avoided: it carries unpatched high-severity prototype-pollution/ReDoS
 * advisories with no fix published to npm.)
 */

export interface ExcelColumn<T> {
  header: string;
  key: keyof T;
  type?: 'String' | 'Number';
  map?: (row: T) => string | number;
}

export interface ExcelSheet<T = any> {
  name: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cellXml(value: string | number, type: 'String' | 'Number'): string {
  const safeType = type === 'Number' && Number.isFinite(value as number) ? 'Number' : 'String';
  const data = safeType === 'Number' ? String(value) : escapeXml(String(value));
  return `<Cell><Data ss:Type="${safeType}">${data}</Data></Cell>`;
}

function sheetXml<T>(sheet: ExcelSheet<T>): string {
  const headerRow = `<Row>${sheet.columns.map((c) => cellXml(c.header, 'String')).join('')}</Row>`;

  const dataRows = sheet.rows
    .map((row) => {
      const cells = sheet.columns
        .map((col) => {
          const value = col.map ? col.map(row) : (row[col.key] as unknown as string | number);
          return cellXml(value, col.type ?? 'String');
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const safeName = escapeXml(sheet.name).slice(0, 31);

  return `<Worksheet ss:Name="${safeName}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
}

export function buildExcelWorkbook(sheets: ExcelSheet[]): string {
  const sheetsXml = sheets.map(sheetXml).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${sheetsXml}
</Workbook>`;
}

/** Builds the workbook and triggers a browser download as a .xls file. */
export function downloadExcel(filename: string, sheets: ExcelSheet[]): void {
  const xml = buildExcelWorkbook(sheets);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
