export type Country = 'SE' | 'FI';
export type PartyType = 'PRIVATE_PERSON' | 'FR';
export type CaseType = 'FT' | 'OT';
export type BalanceDueMode = 'LEGAL_COSTS_ONLY' | 'FULL_AMOUNT';

export interface LineItemTask {
  category: string;
  subTask?: string;
}

export interface LineItem {
  id?: string;
  tasks: LineItemTask[];
  date: string;
  hours: number;
  minutes: number;
}

export interface CaseFormValues {
  caseNumber: string;
  internalReference: string;
  country: Country;
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
  balanceDueMode: BalanceDueMode;
  lineItems: LineItem[];
  pdfPreferences: Record<string, boolean>;
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
