import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CaseFormValues, TotalsSnapshot } from '../types';
import { TASK_CATEGORIES } from '../constants';
import { formatCurrency, formatDate, toNumber } from './format';
import { getBalanceDue, getTimeEntryHours, getTimeEntryTotal } from './calculations';
import { FLYGHJAELP_LOGO_BASE64 } from './logoBase64';

export function generateCostReportPdf(
  values: CaseFormValues,
  totals: TotalsSnapshot,
  calculatedAt: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const currencyStr = values.country === 'FI' ? 'EUR' : 'SEK';

  // --- Header ---
  // Logo
  doc.addImage(FLYGHJAELP_LOGO_BASE64, 'PNG', 15, 15, 45, 13);
  
  // Right side Header (Title and Invoice Nr)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(50, 50, 50);
  doc.text(values.country === 'SE' ? 'Kostnadsredogörelse' : 'invoice', pageWidth - 15, 23, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`# ${values.caseNumber || values.internalReference || '-'}`, pageWidth - 15, 29, { align: 'right' });

  // --- Company Details ---
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  let leftY = 35;
  doc.text('Flyhjælp Aps', 15, leftY);
  doc.setFont('helvetica', 'normal');
  leftY += 5;
  const companyLines = [
    'Holmbladsgade 133',
    '2300 København S',
    'Danmark'
  ];
  doc.text(companyLines, 15, leftY);

  // --- Bill To & Date/Balance ---
  leftY += 20;
  doc.setTextColor(150, 150, 150);
  doc.text('Bill To:', 15, leftY);
  leftY += 5;

  doc.setTextColor(50, 50, 50);
  if (values.partyType === 'FR') {
    doc.setFont('helvetica', 'bold');
    doc.text('Flightright GmbH', 15, leftY);
    doc.setFont('helvetica', 'normal');
    doc.text(['Revaler Straße 28', '10245 Berlin', 'Germany'], 15, leftY + 5);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('Private Person', 15, leftY);
    doc.setFont('helvetica', 'normal');
  }

  // Date and Balance Block (Right side)
  const rightBlockY = leftY - 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Date:', pageWidth - 60, rightBlockY, { align: 'right' });
  doc.setTextColor(50, 50, 50);
  doc.text(formatDate(calculatedAt), pageWidth - 15, rightBlockY, { align: 'right' });

  doc.setFillColor(245, 245, 245);
  doc.rect(pageWidth - 90, rightBlockY + 4, 75, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  const balanceDue = getBalanceDue(totals, values.balanceDueMode, values.caseType);
  doc.text('Balance Due:', pageWidth - 60, rightBlockY + 10, { align: 'right' });
  doc.text(formatCurrency(balanceDue, currencyStr), pageWidth - 17, rightBlockY + 10, { align: 'right' });

  // --- Optional Claim Details ---
  let tableStartY = Math.max(leftY + 25, 95);
  
  const claimData: string[][] = [];
  const prefs = values.pdfPreferences || {};

  if (prefs.claimInterestStartDate && values.claimInterestStartDate) {
    claimData.push(['Interest on Claim from:', formatDate(values.claimInterestStartDate)]);
  }
  if (prefs.legalInterestStartDate && values.legalInterestStartDate) {
    claimData.push(['Interest on Legal Costs from:', formatDate(values.legalInterestStartDate)]);
  }
  if (prefs.compensation && toNumber(values.compensation) > 0) {
    claimData.push(['Compensation:', formatCurrency(toNumber(values.compensation), values.compensationCurrency)]);
  }
  if (prefs.extraExpenses && toNumber(values.extraExpenses) > 0) {
    claimData.push(['Extra Expenses:', formatCurrency(toNumber(values.extraExpenses), values.extraExpensesCurrency)]);
  }
  if (prefs.capitalAmount && totals.claimAmount > 0) {
    claimData.push(['Capital Amount:', formatCurrency(totals.claimAmount, 'EUR')]);
  }
  if (prefs.annualInterestRate && values.annualInterestRate > 0) {
    claimData.push(['Annual Interest Rate:', `${(values.annualInterestRate * 100).toFixed(2)}%`]);
  }

  if (claimData.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Claim Specification', 15, tableStartY);

    autoTable(doc, {
      startY: tableStartY + 3,
      theme: 'plain',
      head: [],
      body: claimData,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [80, 80, 80] },
      columnStyles: { 0: { fontStyle: 'normal', cellWidth: 60 }, 1: { fontStyle: 'bold' } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tableStartY = ((doc as any).lastAutoTable?.finalY ?? tableStartY + 20) + 10;
  }

  // --- Main Table ---
  const lineItems: Array<[string, string, string, string]> = [];

  if (values.caseType === 'FT') {
    const hours = toNumber(values.ftNumberOfPersons);
    if (hours > 0) {
      lineItems.push([
        'Legal Cost',
        hours.toString(),
        formatCurrency(totals.hourlyRate, currencyStr),
        formatCurrency(hours * totals.hourlyRate, currencyStr)
      ]);
    }
  } else {
    // OT Table
    values.lineItems.forEach((item) => {
      const hrs = getTimeEntryHours(item.hours, item.minutes);
      if (hrs > 0) {
        const desc = item.tasks.flatMap(t => {
          if (t.category === 'Manual') return [t.manualText || 'General Legal Work'];
          if (t.subTask) return [t.subTask];
          const subs = TASK_CATEGORIES[t.category as keyof typeof TASK_CATEGORIES];
          return subs ?? [t.category];
        }).join(', ');
        const dateStr = item.date ? `${formatDate(item.date)} ` : '';
        lineItems.push([
          `${dateStr}${desc}`,
          hrs.toFixed(2),
          formatCurrency(totals.hourlyRate, currencyStr),
          formatCurrency(getTimeEntryTotal(item.hours, item.minutes, totals.hourlyRate), currencyStr),
        ]);
      }
    });

    if (values.country === 'SE' && prefs.percentageFee && totals.percentageFee > 0) {
      lineItems.push([
        'Fixed Percentage Fee (45% of Capital Amount)',
        '1',
        '', // Rate is empty for percentage based
        formatCurrency(totals.percentageFee, 'EUR'), // 45% is always in EUR directly
      ]);
    }
    
    if (totals.legalInterest > 0) {
       lineItems.push(['Interest on Legal Costs', '1', '', formatCurrency(totals.legalInterest, currencyStr)]);
    }
  }

  if (prefs.courtFee && toNumber(values.courtFee) > 0) {
    lineItems.push(['Court Fee', '1', '', formatCurrency(toNumber(values.courtFee), currencyStr)]);
  }

  autoTable(doc, {
    startY: tableStartY,
    theme: 'plain',
    head: [['Item', 'Quantity', 'Rate', 'Amount']],
    body: lineItems,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: [50, 50, 50] },
    headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { halign: 'right', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didDrawCell: (data) => {
      if (data.row.section === 'body') {
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.1);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

  // --- Subtotal Block (Bottom Right) ---
  const vatLabelStr = values.country === 'FI' ? 'Tax (25%):' : `Tax (${(totals.vatRate * 100).toFixed(0)}%):`;
  
  autoTable(doc, {
    startY: finalY + 10,
    margin: { left: 120 },
    theme: 'plain',
    body: [
      ['Subtotal:', formatCurrency(totals.subtotal, currencyStr)],
      [vatLabelStr, formatCurrency(totals.vatAmount, currencyStr)],
      ['Total:', formatCurrency(totals.total, currencyStr)],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: [80, 80, 80] },
    columnStyles: { 0: { halign: 'right', cellWidth: 30 }, 1: { halign: 'right', cellWidth: 35, textColor: [50, 50, 50] } },
    didParseCell(data) {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // --- Payment Method Overlay (Bottom Left/Center) ---
  const paymentY = pageHeight - 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  
  const paymentText = `Danske Bank\nAccount Holder: Flyhjælpe ApS\nIBAN: DK38 3000 3002 0796 58\nBIC/SWIFT: DABADKKK\nRef. ${values.internalReference || '-'}`;
  doc.text(paymentText, 15, paymentY);

  doc.save(`invoice-${values.caseNumber || 'lexbill'}.pdf`);
}
