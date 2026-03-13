import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TIME_ENTRY_LABELS } from '../constants';
import type { CaseFormValues, TimeEntryKey, TotalsSnapshot } from '../types';
import { formatCurrency, formatDate, toNumber } from './format';
import { getTimeEntryTotal } from './calculations';
import { FLYGHJAELP_LOGO_BASE64 } from './logoBase64';

export function generateCostReportPdf(
  values: CaseFormValues,
  totals: TotalsSnapshot,
  calculatedAt: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- Header ---
  // Logo
  doc.addImage(FLYGHJAELP_LOGO_BASE64, 'PNG', 15, 15, 50, 15);
  
  // Title (Top Right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(41, 153, 204); // Light blue from logo approximately
  doc.text('KOSTNADSREDOGÖRELSE', pageWidth - 15, 23, { align: 'right' });

  // --- Upper Block ---
  doc.setTextColor(33, 33, 33);
  doc.setFontSize(10);
  
  // Left: Ref & FR Block
  doc.setFont('helvetica', 'bold');
  let leftY = 45;
  doc.text(values.internalReference || '-', 15, leftY);
  leftY += 6;
  
  if (values.partyType === 'FR') {
    doc.text('Flightright GmbH', 15, leftY);
    leftY += 6;
    doc.setFont('helvetica', 'normal');
    const frLines = [
      'VAT nr.:',
      'DE272238629',
      'Revaler Straße 28',
      '10245 Berlin',
      'Tyskland'
    ];
    doc.text(frLines, 15, leftY);
  }

  // Right: Mål.nr & Datum
  doc.setFont('helvetica', 'bold');
  doc.text('Mål.nr', 120, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(values.caseNumber || '-', pageWidth - 15, 45, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Datum', 120, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(calculatedAt), pageWidth - 15, 52, { align: 'right' });

  // Divider Line
  const dividerY = Math.max(leftY + 30, 80);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, dividerY, pageWidth - 15, dividerY);

  // --- Claim Details Block (New) ---
  const claimDetailsYStart = dividerY + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kravspecifikation', 15, claimDetailsYStart);

  autoTable(doc, {
    startY: claimDetailsYStart + 4,
    theme: 'plain',
    head: [],
    body: [
      ['Ränta på krav från:', formatDate(values.claimInterestStartDate)],
      ['Ränta på rättegångskostnader från:', formatDate(values.legalInterestStartDate)],
      ['Kompensation:', formatCurrency(toNumber(values.compensation), values.compensationCurrency)],
      ['Extra utgifter:', formatCurrency(toNumber(values.extraExpenses), values.extraExpensesCurrency)],
      ['Ränta på kapitalbelopp:', formatCurrency(totals.claimInterest, 'EUR')],
      ['Kapitalbelopp:', formatCurrency(totals.claimAmount, 'EUR')],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'normal', cellWidth: 70 },
      1: { fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      // Add a subtle border to the whole block like a structured info panel
      if (data.row.index === 0 && data.column.index === 0) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableStartY = ((doc as any).lastAutoTable?.finalY ?? claimDetailsYStart + 40) + 10;

  // --- Main Table ---
  const lineItems: Array<[string, string, string, string]> = [];

  if (values.caseType === 'FT') {
    lineItems.push(['Rättslig kostnad', '1', '', formatCurrency(toNumber(values.ftNumberOfPersons) * 1982.5)]);
    lineItems.push(['Ansökningsavgift', '1', '', formatCurrency(toNumber(values.courtFee))]);
  } else {
    // OT Table
    (Object.keys(TIME_ENTRY_LABELS) as TimeEntryKey[]).forEach((key) => {
      const entry = values.timeEntries[key];
      const hoursDecimal = entry.hours + entry.minutes / 60;
      if (hoursDecimal > 0) {
        lineItems.push([
          TIME_ENTRY_LABELS[key],
          hoursDecimal.toString(),
          formatCurrency(totals.hourlyRate),
          formatCurrency(getTimeEntryTotal(entry.hours, entry.minutes, totals.hourlyRate)),
        ]);
      }
    });

    if (totals.percentageFee > 0) {
      lineItems.push([
        'Ombudsarvode enligt fast procentsats (45 % av kapitalbeloppet)',
        '1',
        '',
        formatCurrency(totals.percentageFee, 'EUR'),
      ]);
    }
    
    if (toNumber(values.courtFee) > 0) {
       lineItems.push(['Ansökningsavgift', '1', '', formatCurrency(toNumber(values.courtFee))]);
    }

    if (totals.legalInterest > 0) {
       lineItems.push(['Ränta för rättegångskostnader', '1', '', formatCurrency(totals.legalInterest)]);
    }
  }

  autoTable(doc, {
    startY: tableStartY,
    theme: 'plain',
    head: [['Post', 'Antal', 'Timpris', 'Totalt inkl. moms']],
    body: lineItems,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: [0, 0, 0],
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didDrawCell: (data) => {
      if (data.row.section === 'body' || data.row.section === 'head') {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 120;

  // --- Bottom Section ---
  const bottomY = finalY + 15;

  // Payment Method (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BETALNINGS METOD', 15, bottomY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const paymentLines = [
    'Danske Bank',
    'Account Holder: Flyhjælpe ApS',
    'IBAN: DK38 3000 3002 0796 58',
    'BIC/SWIFT: DABADKKK',
    `Ref. ${values.internalReference || '-'}`
  ];
  doc.text(paymentLines, 15, bottomY + 6);

  // Totals (Right)
  autoTable(doc, {
    startY: bottomY - 5,
    margin: { left: 120 },
    theme: 'plain',
    body: [
      ['Delsumma', formatCurrency(totals.subtotal)],
      [`Moms (${(totals.vatRate * 100).toFixed(0)}%)`, formatCurrency(totals.vatAmount)],
      ['Totalt', formatCurrency(totals.total)],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { halign: 'right', cellWidth: 35 },
    },
    didDrawCell: (data) => {
      if (data.row.index === 1 && data.column.index === 0) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + 75,
          data.cell.y + data.cell.height
        );
      }
    },
    didParseCell(data) {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // --- Footer ---
  const footerHeight = 15;
  doc.setFillColor(41, 153, 204);
  doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const footerText = 'bogholderi@flyhjaelp.dk   |   +46 31 308 88   |   Flyghjälp / Flyhjælp ApS - Holmbladsgade 133 - 2300 Köpenhamn, Danmark - Org.nr: 36917490';
  doc.text(footerText, pageWidth / 2, pageHeight - 6, { align: 'center' });

  doc.save(`kostnadsrapport-${values.caseNumber || 'arende'}.pdf`);
}
