import {
  DEFAULT_ANNUAL_INTEREST_RATE,
  TIME_ENTRY_LABELS,
} from '../constants';
import type {
  CaseFormValues,
  PartyType,
  TimeEntryKey,
  TotalsSnapshot,
} from '../types';
import { roundCurrency, toNumber } from './format';

export function getHourlyRate(partyType: PartyType): number {
  return partyType === 'FR' ? 1586 : 1982.5;
}

export function getVatRate(partyType: PartyType): number {
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
  const hourlyRate = getHourlyRate(values.partyType);
  const vatRate = getVatRate(values.partyType);
  
  const claimAmountEur = getClaimAmountEur(values);
  
  const compSek = values.compensationCurrency === 'SEK' ? toNumber(values.compensation) : toNumber(values.compensation) / (values.exchangeRateSekToEur || 1);
  const extraSek = values.extraExpensesCurrency === 'SEK' ? toNumber(values.extraExpenses) : toNumber(values.extraExpenses) / (values.exchangeRateSekToEur || 1);
  const claimAmountSek = roundCurrency(compSek + extraSek); // Used for legacy subtotal base logic

  const timeEntriesTotalSek = (Object.keys(TIME_ENTRY_LABELS) as TimeEntryKey[]).reduce(
    (sum, key) =>
      sum +
      getTimeEntryTotal(
        values.timeEntries[key].hours,
        values.timeEntries[key].minutes,
        hourlyRate,
      ),
    0,
  );

  const percentageFeeEur = values.caseType === 'OT' ? getOtPercentageFeeEur(claimAmountEur) : 0;
  const percentageFeeSek = getOtPercentageFeeSek(percentageFeeEur, values.exchangeRateSekToEur);
  
  const claimInterestEur = options?.claimInterest ?? 0;
  const legalInterestSek = options?.legalInterest ?? 0;
  
  const ftLegalCostSek = toNumber(values.ftNumberOfPersons) * 1982.5;
  const legalCostBaseSek =
    values.caseType === 'FT'
      ? roundCurrency(ftLegalCostSek + toNumber(values.courtFee))
      : roundCurrency(timeEntriesTotalSek + toNumber(values.courtFee) + legalInterestSek);

  const subtotalSek =
    values.caseType === 'FT'
      ? roundCurrency(claimAmountSek + ftLegalCostSek + toNumber(values.courtFee))
      : roundCurrency(claimAmountSek + legalCostBaseSek);

  const vatBaseSek = values.caseType === 'FT' ? ftLegalCostSek : roundCurrency(timeEntriesTotalSek + percentageFeeSek);
  const vatAmountSek = roundCurrency(vatBaseSek * vatRate);
  
  // The grand total still aggregates everything. The total reflects the strict subtotal + vat.
  const totalSek = roundCurrency(subtotalSek + vatAmountSek);
  
  const grandTotalSek = roundCurrency(totalSek + (claimInterestEur / (values.exchangeRateSekToEur || 1)) + percentageFeeSek);

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
    grandTotal: grandTotalSek,
  };
}

export function buildLegalCostPrincipal(values: CaseFormValues): number {
  const vatRate = getVatRate(values.partyType);

  if (values.caseType === 'FT') {
    const ftCost = toNumber(values.ftNumberOfPersons) * 1982.5;
    const vatAmount = roundCurrency(ftCost * vatRate);
    return roundCurrency(ftCost + vatAmount + toNumber(values.courtFee));
  }

  const hourlyRate = getHourlyRate(values.partyType);
  const timeEntriesTotalSek = (Object.keys(TIME_ENTRY_LABELS) as TimeEntryKey[]).reduce(
    (sum, key) =>
      sum +
      getTimeEntryTotal(
        values.timeEntries[key].hours,
        values.timeEntries[key].minutes,
        hourlyRate,
      ),
    0,
  );

  const percentageFeeEur = getOtPercentageFeeEur(getClaimAmountEur(values));
  const percentageFeeSek = getOtPercentageFeeSek(percentageFeeEur, values.exchangeRateSekToEur);
  
  const vatAmountSek = roundCurrency((timeEntriesTotalSek + percentageFeeSek) * vatRate);

  return roundCurrency(timeEntriesTotalSek + percentageFeeSek + vatAmountSek + toNumber(values.courtFee));
}
