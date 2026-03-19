import {
  DEFAULT_ANNUAL_INTEREST_RATE,
  EUR_HOURLY_RATE,
  SEK_HOURLY_RATE,
  SEK_HOURLY_RATE_EX_VAT,
} from '../constants';
import type {
  BalanceDueMode,
  CaseFormValues,
  CaseType,
  Country,
  LineItem,
  PartyType,
  TotalsSnapshot,
} from '../types';
import { roundCurrency, toNumber } from './format';

export function getHourlyRate(country: Country, partyType: PartyType): number {
  if (country === 'FI') return EUR_HOURLY_RATE;
  return partyType === 'FR' ? SEK_HOURLY_RATE_EX_VAT : SEK_HOURLY_RATE;
}

export function getVatRate(country: Country, partyType: PartyType): number {
  if (country === 'FI') return 0.25; // Displays as 25% but calculated amount is 0
  return partyType === 'FR' ? 0 : 0.25;
}

export function convertToEur(amount: number, currency: 'EUR' | 'SEK', exchangeRateSekToEur: number): number {
  if (currency === 'EUR') return amount;
  return roundCurrency(amount * exchangeRateSekToEur);
}

export function getClaimAmountEur(values: Pick<CaseFormValues, 'compensation' | 'extraExpenses' | 'compensationCurrency' | 'extraExpensesCurrency' | 'exchangeRateSekToEur'>): number {
  const compEur = convertToEur(toNumber(values.compensation), values.compensationCurrency, values.exchangeRateSekToEur);
  const extraEur = convertToEur(toNumber(values.extraExpenses), values.extraExpensesCurrency, values.exchangeRateSekToEur);
  return roundCurrency(compEur + extraEur);
}

export function getTimeEntryHours(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

export function getTimeEntryTotal(
  hours: number,
  minutes: number,
  hourlyRate: number,
): number {
  return roundCurrency(getTimeEntryHours(hours, minutes) * hourlyRate);
}

export function getInterestAmount(
  principal: number,
  annualRate = DEFAULT_ANNUAL_INTEREST_RATE,
  startDate?: string,
  endDate = new Date(),
): number {
  if (!principal || !startDate) {
    return 0;
  }

  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const diffMs = endDate.getTime() - start.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  return roundCurrency(principal * annualRate * (days / 365));
}

export function getOtPercentageFeeEur(claimAmountEur: number): number {
  return roundCurrency(claimAmountEur * 0.45);
}

export function getOtPercentageFeeSek(percentageFeeEur: number, exchangeRateSekToEur: number): number {
  if (exchangeRateSekToEur === 0) return 0;
  return roundCurrency(percentageFeeEur / exchangeRateSekToEur);
}

export function getCalculatedTotals(
  values: CaseFormValues,
  options?: {
    claimInterest?: number;
    legalInterest?: number;
  },
): TotalsSnapshot {
  const hourlyRate = getHourlyRate(values.country, values.partyType);
  const vatRate = getVatRate(values.country, values.partyType);
  
  const claimAmountEur = getClaimAmountEur(values);
  
  const compSek = values.compensationCurrency === 'SEK' ? toNumber(values.compensation) : toNumber(values.compensation) / (values.exchangeRateSekToEur || 1);
  const extraSek = values.extraExpensesCurrency === 'SEK' ? toNumber(values.extraExpenses) : toNumber(values.extraExpenses) / (values.exchangeRateSekToEur || 1);
  const claimAmountSek = roundCurrency(compSek + extraSek);

  const timeEntriesTotalSek = values.lineItems.reduce(
    (sum, item) => sum + getTimeEntryTotal(item.hours, item.minutes, hourlyRate),
    0,
  );

  let percentageFeeEur = 0;
  if (values.caseType === 'OT' && values.country === 'SE') {
    percentageFeeEur = getOtPercentageFeeEur(claimAmountEur);
  }
  const percentageFeeSek = getOtPercentageFeeSek(percentageFeeEur, values.exchangeRateSekToEur);
  
  const claimInterestEur = options?.claimInterest ?? 0;
  const legalInterestSek = options?.legalInterest ?? 0;
  
  const ftLegalCostSek = toNumber(values.ftNumberOfPersons) * hourlyRate;
  const legalCostBaseSek =
    values.caseType === 'FT'
      ? roundCurrency(ftLegalCostSek + toNumber(values.courtFee))
      : roundCurrency(timeEntriesTotalSek + toNumber(values.courtFee) + legalInterestSek);

  const subtotalSek =
    values.caseType === 'FT'
      ? roundCurrency(ftLegalCostSek + toNumber(values.courtFee))
      : roundCurrency(timeEntriesTotalSek + percentageFeeSek + toNumber(values.courtFee));

  const vatBaseSek = values.caseType === 'FT' ? ftLegalCostSek : roundCurrency(timeEntriesTotalSek + percentageFeeSek);
  
  // Finnish VAT amount is always 0
  const vatAmountSek = values.country === 'FI' ? 0 : roundCurrency(vatBaseSek * vatRate);
  
  // The grand total still aggregates everything. The total reflects the strict subtotal + vat.
  const totalSek = roundCurrency(subtotalSek + vatAmountSek);
  
  let grandTotal: number;
  if (values.country === 'FI') {
    // FI: hourlyRate is EUR so totalSek/legalInterestSek are already EUR
    grandTotal = values.caseType === 'FT'
      ? roundCurrency(claimAmountEur + claimInterestEur + totalSek)
      : roundCurrency(claimAmountEur + claimInterestEur + legalInterestSek + totalSek);
  } else {
    // SE: convert EUR-denominated values to SEK before summing
    const claimInterestSek = roundCurrency(claimInterestEur / (values.exchangeRateSekToEur || 1));
    grandTotal = values.caseType === 'FT'
      ? roundCurrency(claimAmountSek + claimInterestSek + totalSek)
      : roundCurrency(claimAmountSek + claimInterestSek + legalInterestSek + totalSek);
  }

  return {
    hourlyRate,
    vatRate,
    vatAmount: vatAmountSek,
    claimAmount: claimAmountEur,
    legalCostBase: legalCostBaseSek,
    timeEntriesTotal: roundCurrency(timeEntriesTotalSek),
    percentageFee: percentageFeeEur,
    subtotal: subtotalSek,
    total: totalSek,
    claimInterest: claimInterestEur,
    legalInterest: legalInterestSek,
    grandTotal,
  };
}

export function getBalanceDue(totals: TotalsSnapshot, mode: BalanceDueMode, caseType: CaseType): number {
  if (mode === 'FULL_AMOUNT') return totals.grandTotal;
  return caseType === 'FT'
    ? totals.total
    : roundCurrency(totals.total + totals.legalInterest);
}

export function buildLegalCostPrincipal(values: CaseFormValues): number {
  const vatRate = getVatRate(values.country, values.partyType);
  const hourlyRate = getHourlyRate(values.country, values.partyType);

  if (values.caseType === 'FT') {
    const ftCost = toNumber(values.ftNumberOfPersons) * hourlyRate;
    const vatAmount = values.country === 'FI' ? 0 : roundCurrency(ftCost * vatRate);
    return roundCurrency(ftCost + vatAmount + toNumber(values.courtFee));
  }

  const timeEntriesTotalSek = values.lineItems.reduce(
    (sum, item) => sum + getTimeEntryTotal(item.hours, item.minutes, hourlyRate),
    0,
  );

  let percentageFeeEur = 0;
  if (values.country === 'SE') {
    percentageFeeEur = getOtPercentageFeeEur(getClaimAmountEur(values));
  }
  const percentageFeeSek = getOtPercentageFeeSek(percentageFeeEur, values.exchangeRateSekToEur);
  
  const vatAmountSek = values.country === 'FI' ? 0 : roundCurrency((timeEntriesTotalSek + percentageFeeSek) * vatRate);

  return roundCurrency(timeEntriesTotalSek + percentageFeeSek + vatAmountSek + toNumber(values.courtFee));
}
