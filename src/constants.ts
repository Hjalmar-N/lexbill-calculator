import type { CaseFormValues } from './types';

export const STORAGE_KEY = 'lexbill-cases';
export const DEFAULT_ANNUAL_INTEREST_RATE = 0.08;

export const MINUTE_OPTIONS = [0, 15, 30, 45];
export const HOUR_OPTIONS = Array.from({ length: 21 }, (_, index) => index);

export const SEK_HOURLY_RATE = 1982.50;
export const SEK_HOURLY_RATE_EX_VAT = 1586;
export const SEK_HOURLY_RATE_2026 = 2032.50;
export const SEK_HOURLY_RATE_2026_EX_VAT = 1626;
export const EUR_HOURLY_RATE = 250;

export const TASK_CATEGORIES = {
  'Pre-Court & Case Intake': [
    'Initial Case Review',
    'Document drafting',
    'Document Review',
    'Client Correspondence',
    'Conflict Check',
    'Legal Analysis',
    'Demand Letter',
    'Initial Consultation',
    'Subpoena Preparation',
    'Correspondence Airline',
    'Claim sent'
  ],
  'Litigation & Drafting': [
    'Research',
    'Defense Analysis',
    'Evidence Collection',
    'Drafting Briefs',
    'Drafting Pleading',
    'Finishing statement',
    'Evidence summary'
  ],
  'Court / Correspondence': [
    'Court Correspondence',
    'Adverse Party Liaison'
  ],
  'Other': [
    'Settlement Discussion',
    'Opposing Counsel Liaison',
    'Drafting'
  ]
};

export const DEFAULT_PDF_PREFERENCES = {
  compensation: false,
  extraExpenses: false,
  capitalAmount: false,
  courtFee: false,
  annualInterestRate: false,
  claimInterestStartDate: false,
  legalInterestStartDate: false,
  percentageFee: false,
};

export const DEFAULT_FORM_VALUES: CaseFormValues = {
  caseNumber: '',
  internalReference: '',
  country: 'SE',
  partyType: 'FR',
  caseType: 'OT',
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
  balanceDueMode: 'LEGAL_COSTS_ONLY',
  swedenRateYear: 'BEFORE_2026',
  lineItems: [],
  pdfPreferences: DEFAULT_PDF_PREFERENCES,
};
