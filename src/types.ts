export type PartyType = 'PRIVATE_PERSON' | 'FR';
export type CaseType = 'FT' | 'OT';

export type TimeEntryKey =
  | 'analysis'
  | 'communication'
  | 'response';

export interface TimeEntryFormValue {
  hours: number;
  minutes: number;
}

export interface CaseFormValues {
  caseNumber: string;
  internalReference: string;
  partyType: PartyType;
  caseType: CaseType;
  compensation: number | '';
  extraExpenses: number | '';
  ftNumberOfPersons: number | '';
  courtFee: number | '';
  claimInterestStartDate: string;
  legalInterestStartDate: string;
  annualInterestRate: number;
  compensationCurrency: 'EUR' | 'SEK';
  extraExpensesCurrency: 'EUR' | 'SEK';
  exchangeRateSekToEur: number;
  timeEntries: Record<TimeEntryKey, TimeEntryFormValue>;
}

export interface TotalsSnapshot {
  hourlyRate: number;
  vatRate: number;
  vatAmount: number;
  claimAmount: number;
  legalCostBase: number;
  timeEntriesTotal: number;
  percentageFee: number;
  subtotal: number;
  total: number;
  claimInterest: number;
  legalInterest: number;
  grandTotal: number;
}

export interface SavedCase {
  form: CaseFormValues;
  calculatedAt: string;
  annualInterestRate: number;
  totals: TotalsSnapshot;
}
