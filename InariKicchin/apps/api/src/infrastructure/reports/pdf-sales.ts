/**
 * Minimal PDF writer for sales reports (no external deps).
 * Produces a multi-page A4 text table suitable for business use.
 */

type SalesRow = {
  orderNo?: string;
  createdAt?: string;
  orderType?: string;
  status?: string;
  paymentStatus?: string;
  subtotal?: number;
  vatAmount?: number;
  totalAmount?: number;
};

export type SalesReportPdfInput = {
  from: string;
  to: string;
  generatedAt?: string;
  orders: number;
  grossSales: number;
  vatCollected: number;
  netSales: number;
  averageOrder: number;
  stockUsedValue?: number;
  wastageValue?: number;
  byOrderType?: Record<string, number>;
  note?: string;
  orderRows?: SalesRow[];
};

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function money(n: number | undefined | null): string {
  return Number(n || 0).toFixed(2);
}

function buildContent(input: SalesReportPdfInput): string[] {
  const lines: string[] = [];
  const gen = input.generatedAt ?? new Date().toISOString();
  lines.push('InariKicchin — Sales Report');
  lines.push(`Period: ${input.from} to ${input.to}`);
  lines.push(`Generated: ${gen}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push(`Orders: ${input.orders}`);
  lines.push(`Gross sales (KSh): ${money(input.grossSales)}`);
  lines.push(`VAT collected (KSh): ${money(input.vatCollected)}`);
  lines.push(`Net sales (KSh): ${money(input.netSales)}`);
  lines.push(`Average order (KSh): ${money(input.averageOrder)}`);
  if (input.stockUsedValue != null) {
    lines.push(`Stock used value (KSh): ${money(input.stockUsedValue)}  [utilisation cost, not profit]`);
  }
  if (input.wastageValue != null) {
    lines.push(`Wastage value (KSh): ${money(input.wastageValue)}`);
  }
  if (input.byOrderType && Object.keys(input.byOrderType).length) {
    lines.push('');
    lines.push('BY ORDER TYPE');
    for (const [k, v] of Object.entries(input.byOrderType).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${k}: KSh ${money(v)}`);
    }
  }
  if (input.note) {
    lines.push('');
    lines.push(`Note: ${input.note}`);
  }
  const rows = input.orderRows ?? [];
  if (rows.length) {
    lines.push('');
    lines.push('ORDER DETAIL');
    lines.push('OrderNo | Date | Type | Status | Pay | Subtotal | VAT | Total');
    for (const o of rows.slice(0, 500)) {
      const date = (o.createdAt ?? '').slice(0, 19).replace('T', ' ');
      lines.push(
        [
          o.orderNo ?? '',
          date,
          o.orderType ?? '',
          o.status ?? '',
          o.paymentStatus ?? '',
          money(o.subtotal),
          money(o.vatAmount),
          money(o.totalAmount),
        ].join(' | '),
      );
    }
    if (rows.length > 500) {
      lines.push(`… ${rows.length - 500} more rows omitted (export CSV for full detail)`);
    }
  } else {
    lines.push('');
    lines.push('No order lines in this period.');
  }
  lines.push('');
  lines.push('— End of report —');
  return lines;
}

/** Build a simple multi-page PDF buffer from text lines. */
export function buildSalesReportPdf(input: SalesReportPdfInput): Buffer {
  const textLines = buildContent(input);
  const pageWidth = 595; // A4
  const pageHeight = 842;
  const marginLeft = 40;
  const marginTop = 50;
  const lineHeight = 12;
  const maxLinesPerPage = Math.floor((pageHeight - marginTop - 40) / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < textLines.length; i += maxLinesPerPage) {
    pages.push(textLines.slice(i, i + maxLinesPerPage));
  }
  if (!pages.length) pages.push(['(empty report)']);

  const objects: string[] = [];
  // 1: Catalog
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  // 2: Pages (kids filled later)
  const kidsRefs = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kidsRefs}] /Count ${pages.length} >>`);

  let objNum = 3;
  const contentObjectNumbers: number[] = [];
  for (let p = 0; p < pages.length; p++) {
    const pageObjNum = objNum++;
    const contentObjNum = objNum++;
    contentObjectNumbers.push(contentObjNum);

    // Page object
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> >>`,
    );

    // Content stream
    const streamLines: string[] = [];
    streamLines.push('BT');
    streamLines.push('/F1 10 Tf');
    streamLines.push(`${marginLeft} ${pageHeight - marginTop} Td`);
    streamLines.push(`${lineHeight} TL`);
    const pageLines = pages[p];
    for (let i = 0; i < pageLines.length; i++) {
      const t = esc(pageLines[i]);
      if (i === 0) streamLines.push(`(${t}) Tj`);
      else streamLines.push(`T* (${t}) Tj`);
    }
    // footer
    streamLines.push(`T* () Tj`);
    streamLines.push(`T* (${esc(`Page ${p + 1} of ${pages.length}  |  InariKicchin`)}) Tj`);
    streamLines.push('ET');
    const stream = streamLines.join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  }

  // Font object (Helvetica)
  const fontObjNum = objNum++;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  // Fix page resource font refs to actual font object number
  for (let p = 0; p < pages.length; p++) {
    const pageIndex = 2 + p * 2; // 0-based in objects array: catalog=0, pages=1, then pairs
    objects[pageIndex] = objects[pageIndex].replace(
      /\/F1 \d+ 0 R/,
      `/F1 ${fontObjNum} 0 R`,
    );
  }

  // Assemble PDF
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}
