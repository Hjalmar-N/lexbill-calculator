import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch, useFieldArray } from 'react-hook-form';
import {
  DEFAULT_ANNUAL_INTEREST_RATE,
  DEFAULT_FORM_VALUES,
} from './constants';
import type { CaseFormValues, SavedCase, TotalsSnapshot } from './types';
import {
  buildLegalCostPrincipal,
  getBalanceDue,
  getCalculatedTotals,
  getClaimAmountEur,
  getInterestAmount,
} from './utils/calculations';
import { formatCurrency, formatDate } from './utils/format';
import { generateCostReportPdf } from './utils/pdf';
import {
  loadCasesFromFirestore,
  saveCaseToFirestore,
  deleteCaseFromFirestore,
} from './utils/storage';
import { signOut } from 'firebase/auth';
import { auth } from './utils/firebase';
import { useAuth } from './contexts/AuthContext';
import { LineItemRow } from './components/LineItemRow';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WatchedFormValues = any;

function normalizeFormValues(partial?: WatchedFormValues): CaseFormValues {
  return {
    ...DEFAULT_FORM_VALUES,
    ...partial,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineItems: (partial?.lineItems || []).map((item: any) => ({
      ...item,
      tasks: item?.tasks || [],
    })),
  };
}

function App() {
  const { currentUser } = useAuth();
  const [savedCases, setSavedCases] = useState<Record<string, SavedCase>>({});
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [persistedTotals, setPersistedTotals] = useState<TotalsSnapshot>(() =>
    getCalculatedTotals(DEFAULT_FORM_VALUES),
  );

  const { control, register, handleSubmit, reset } = useForm<CaseFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const { fields, append: appendLineItem, remove: removeLineItem, swap: swapLineItem } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedValues = useWatch({ control });
  const values = normalizeFormValues(watchedValues);
  
  useEffect(() => {
    if (!currentUser) return;
    loadCasesFromFirestore(currentUser.uid).then(setSavedCases).catch(console.error);
  }, [currentUser]);

  const liveTotals = useMemo(
    () =>
      getCalculatedTotals(values, {
        claimInterest: persistedTotals.claimInterest,
        legalInterest: persistedTotals.legalInterest,
      }),
    [persistedTotals.claimInterest, persistedTotals.legalInterest, values],
  );

  const onSave = async (formValues: CaseFormValues) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const claimInterest = getInterestAmount(
        getClaimAmountEur(formValues),
        formValues.annualInterestRate,
        formValues.claimInterestStartDate,
      );
      const legalInterest = getInterestAmount(
        buildLegalCostPrincipal(formValues),
        formValues.annualInterestRate,
        formValues.legalInterestStartDate,
      );
      const totals = getCalculatedTotals(formValues, { claimInterest, legalInterest });

      const calculatedAt = new Date().toISOString();
      const savedCase: SavedCase = {
        form: { ...formValues, ftNumberOfPersons: formValues.caseType === 'FT' ? formValues.ftNumberOfPersons : '' },
        calculatedAt,
        annualInterestRate: formValues.annualInterestRate,
        totals,
      };

      const docId = await saveCaseToFirestore(currentUser.uid, activeDocId, savedCase);
      setActiveDocId(docId);
      setSavedCases(await loadCasesFromFirestore(currentUser.uid));
      setPersistedTotals(totals);
      setLastSavedAt(calculatedAt);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const loadCase = (docId: string) => {
    const saved = savedCases[docId];
    if (!saved) return;
    setActiveDocId(docId);
    reset(saved.form);
    setPersistedTotals(saved.totals);
    setLastSavedAt(saved.calculatedAt);
  };

  const newCase = () => {
    setActiveDocId(null);
    reset(DEFAULT_FORM_VALUES);
    setPersistedTotals(getCalculatedTotals(DEFAULT_FORM_VALUES));
    setLastSavedAt('');
  };

  const deleteCase = async (docId: string) => {
    if (!currentUser) return;
    try {
      await deleteCaseFromFirestore(currentUser.uid, docId);
      setSavedCases(await loadCasesFromFirestore(currentUser.uid));
      if (activeDocId === docId) newCase();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const currCurrency = values.country === 'FI' ? 'EUR' : 'SEK';

  return (
    <div className="invoice-builder-wrapper">
      <div className="top-bar-actions">
        <button type="button" className="btn btn-danger" onClick={() => signOut(auth)}>Log Out</button>
        <button type="button" className="btn btn-secondary" onClick={newCase}>New Case</button>
        <button type="button" className="btn btn-secondary" onClick={() => generateCostReportPdf(values, liveTotals, lastSavedAt || new Date().toISOString())}>
          Generate PDF
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSubmit(onSave)} disabled={saving}>
          {saving ? 'Saving…' : 'Save Progress'}
        </button>
      </div>

      <form className="invoice-paper" onSubmit={handleSubmit(onSave)}>
        
        {/* --- Header Row --- */}
        <div className="invoice-row">
          <div className="header-left">
            <h1 style={{ marginBottom: '24px' }}>LexBill</h1>
            
            <div className="meta-grid" style={{ marginBottom: '24px' }}>
              <label>Country Domain</label>
              <div className="country-radio-group">
                <label><input type="radio" value="SE" {...register('country')} /> Sweden (SE)</label>
                <label><input type="radio" value="FI" {...register('country')} /> Finland (FI)</label>
              </div>

              {values.country === 'SE' && (
                <>
                  <label>Swedish Rate</label>
                  <select {...register('swedenRateYear')}>
                    <option value="BEFORE_2026">Before 2026</option>
                    <option value="AFTER_2026">After 2026</option>
                  </select>
                </>
              )}

              <label>Bill To (Party)</label>
              <select {...register('partyType')}>
                <option value="PRIVATE_PERSON">Private Person</option>
                <option value="FR">FR (Flightright GmbH)</option>
              </select>

              <label>Who is this from?</label>
              <input {...register('internalReference')} placeholder="Internal Reference (LEX-2026-001)" />
            </div>
          </div>
          
          <div className="header-right">
            <h2 className="title-text">INVOICE</h2>
            <div className="meta-grid">
              <label>Invoice #</label>
              <input {...register('caseNumber')} placeholder="T 1234-26" />
              
              <label>Date Saved</label>
              <output className="readonly-output" style={{ background: 'transparent', border: 'none', paddingLeft: 0 }}>
                {lastSavedAt ? formatDate(lastSavedAt) : 'Unsaved'}
              </output>

              <label>Case Type</label>
              <select {...register('caseType')}>
                <option value="FT">FT</option>
                <option value="OT">OT</option>
              </select>
            </div>
          </div>
        </div>

        {/* --- Claim Details block --- */}
        <div className="claim-section">
          <h3 className="section-title">Claim Parameters & Settings</h3>
          <div className="claim-grid">
            <div className="claim-group">
              <label>Compensation</label>
              <div className="combined-input">
                <input type="number" step="0.01" placeholder="0" {...register('compensation', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
                <select {...register('compensationCurrency')}><option value="EUR">EUR</option><option value="SEK">SEK</option></select>
              </div>
              <div className="pdf-toggle">
                <input id="pdf-comp" type="checkbox" {...register('pdfPreferences.compensation')} />
                <label htmlFor="pdf-comp">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>Extra Expenses</label>
              <div className="combined-input">
                <input type="number" step="0.01" placeholder="0" {...register('extraExpenses', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
                <select {...register('extraExpensesCurrency')}><option value="EUR">EUR</option><option value="SEK">SEK</option></select>
              </div>
              <div className="pdf-toggle">
                <input id="pdf-extra" type="checkbox" {...register('pdfPreferences.extraExpenses')} />
                <label htmlFor="pdf-extra">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>Capital Amount</label>
              <output className="readonly-output">{formatCurrency(liveTotals.claimAmount, 'EUR')}</output>
              <div className="pdf-toggle">
                <input id="pdf-cap" type="checkbox" {...register('pdfPreferences.capitalAmount')} />
                <label htmlFor="pdf-cap">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>Court Fee</label>
              <input type="number" step="0.01" placeholder="0" {...register('courtFee', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
              <div className="pdf-toggle">
                <input id="pdf-court" type="checkbox" {...register('pdfPreferences.courtFee')} />
                <label htmlFor="pdf-court">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>Annual Interest Rate</label>
              <input type="number" step="0.01" {...register('annualInterestRate', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
              <div className="pdf-toggle">
                <input id="pdf-int" type="checkbox" {...register('pdfPreferences.annualInterestRate')} />
                <label htmlFor="pdf-int">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>SEK to EUR Rate</label>
              <input type="number" step="0.0001" {...register('exchangeRateSekToEur', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
            </div>

            <div className="claim-group">
              <label>Interest Start (Claim)</label>
              <input type="date" {...register('claimInterestStartDate')} />
              <div className="pdf-toggle">
                <input id="pdf-claim-start" type="checkbox" {...register('pdfPreferences.claimInterestStartDate')} />
                <label htmlFor="pdf-claim-start">Show on PDF</label>
              </div>
            </div>

            <div className="claim-group">
              <label>Interest Start (Legal Costs)</label>
              <input type="date" {...register('legalInterestStartDate')} />
              <div className="pdf-toggle">
                <input id="pdf-legal-start" type="checkbox" {...register('pdfPreferences.legalInterestStartDate')} />
                <label htmlFor="pdf-legal-start">Show on PDF</label>
              </div>
            </div>
          </div>
        </div>

        {/* --- Line Items Table --- */}
        {values.caseType === 'OT' ? (
          <div className="line-items-section">
            <div className="table-header">
              <div>Item</div>
              <div>Hrs</div>
              <div>Mins</div>
              <div></div>
            </div>
            {fields.map((field, index) => (
              <LineItemRow
                key={field.id}
                control={control}
                index={index}
                remove={removeLineItem}
                totalItems={fields.length}
                swapItems={swapLineItem}
              />
            ))}
            <button type="button" className="add-line-btn" onClick={() => appendLineItem({ tasks: [], date: new Date().toISOString().split('T')[0], hours: 0, minutes: 0 })}>
              + Line Item
            </button>
          </div>
        ) : (
          <div className="line-items-section" style={{ maxWidth: '400px' }}>
            <h3 className="section-title">FT Legal Costs</h3>
            <div className="claim-group">
              <label>Number of Persons</label>
              <input type="number" step="1" placeholder="0" {...register('ftNumberOfPersons', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
            </div>
          </div>
        )}

        {/* --- Footer Row --- */}
        <div className="invoice-row" style={{ marginTop: '20px' }}>
          <div className="footer-left">
            <div className="saved-cases-block">
              <label>Load Saved Case</label>
              <select defaultValue="" onChange={(e) => { if (e.target.value) loadCase(e.target.value); }}>
                <option value="">Select saved case to load...</option>
                {Object.entries(savedCases).map(([docId, c]) => (
                  <option key={docId} value={docId}>
                    {c.form.caseNumber || c.form.internalReference || 'Untitled'}
                  </option>
                ))}
              </select>
              {activeDocId && (
                <button type="button" className="btn btn-danger" style={{ marginTop: '4px', fontSize: '0.75rem', padding: '2px 8px' }} onClick={() => deleteCase(activeDocId)}>
                  Delete Current Case
                </button>
              )}
            </div>
          </div>
          
          <div className="footer-right">
            <div className="totals-grid">
              <span>Time Fee Total</span>
              <span>{formatCurrency(liveTotals.timeEntriesTotal, currCurrency)}</span>
              
              {values.country === 'SE' && (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <input type="checkbox" id="pdf-perc" style={{width: 12}} {...register('pdfPreferences.percentageFee')} /> 
                    <label htmlFor="pdf-perc" style={{fontSize: '0.75rem', color: '#888'}}>PDF</label>
                    Fixed Percentage Fee
                  </span>
                  <span>{formatCurrency(liveTotals.percentageFee, 'EUR')}</span>
                </>
              )}

              <span>Subtotal</span>
              <span>{formatCurrency(liveTotals.subtotal, currCurrency)}</span>

              <span>Tax</span>
              <span>{formatCurrency(liveTotals.vatAmount, currCurrency)}</span>

              <span>Interest on Claim</span>
              <span>{formatCurrency(liveTotals.claimInterest, 'EUR')}</span>

              <span>Interest on External Costs</span>
              <span>{formatCurrency(liveTotals.legalInterest, currCurrency)}</span>

              <span className="balance-due-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Balance Due
                <select {...register('balanceDueMode')} style={{ fontSize: '0.7rem', padding: '1px 4px' }}>
                  <option value="LEGAL_COSTS_ONLY">Legal Costs Only</option>
                  <option value="FULL_AMOUNT">Full Amount</option>
                </select>
              </span>
              <span className="balance-due-val">{formatCurrency(getBalanceDue(liveTotals, values.balanceDueMode, values.caseType), currCurrency)}</span>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}

export default App;
