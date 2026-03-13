import type { CaseFormValues, TimeEntryKey } from './types';

export const STORAGE_KEY = 'lexbill-cases';
export const DEFAULT_ANNUAL_INTEREST_RATE = 0.08;

export const MINUTE_OPTIONS = [0, 15, 30, 45];
export const HOUR_OPTIONS = Array.from({ length: 21 }, (_, index) => index);

export const TIME_ENTRY_LABELS: Record<TimeEntryKey, string> = {
  analysis:
    'Juridisk analys och ärendegenomgång, inkl. stämningsansökan och överlåtelseavtal',
  communication: 'Kommunikation och rådgivning till klienter',
  response: 'Yttrande, analysering av bevisning och svaromål',
};

export const DEFAULT_FORM_VALUES: CaseFormValues = {
  caseNumber: '',
  internalReference: '',
  partyType: 'PRIVATE_PERSON',
  caseType: 'FT',
  compensation: '',
  extraExpenses: '',
  ftNumberOfPersons: '',
  courtFee: '',
  claimInterestStartDate: '',
  legalInterestStartDate: '',
  annualInterestRate: DEFAULT_ANNUAL_INTEREST_RATE,
  compensationCurrency: 'EUR',
  extraExpensesCurrency: 'EUR',
  exchangeRateSekToEur: 0.088,
  timeEntries: {
    analysis: { hours: 0, minutes: 0 },
    communication: { hours: 0, minutes: 0 },
    response: { hours: 0, minutes: 0 },
  },
};
