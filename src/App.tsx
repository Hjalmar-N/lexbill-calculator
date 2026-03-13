import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  DEFAULT_ANNUAL_INTEREST_RATE,
  DEFAULT_FORM_VALUES,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  TIME_ENTRY_LABELS,
} from './constants';
import type { CaseFormValues, SavedCase, TimeEntryKey, TotalsSnapshot } from './types';
import {
  buildLegalCostPrincipal,
  getCalculatedTotals,
  getClaimAmountEur,
  getHourlyRate,
  getInterestAmount,
  getTimeEntryHours,
  getTimeEntryTotal,
  getVatRate,
} from './utils/calculations';
import { formatCurrency, formatDate } from './utils/format';
import { generateCostReportPdf } from './utils/pdf';
import { loadSavedCases, saveCaseToStorage } from './utils/storage';

type WatchedFormValues = Partial<Omit<CaseFormValues, 'timeEntries'>> & {
  timeEntries?: Partial<Record<TimeEntryKey, Partial<CaseFormValues['timeEntries'][TimeEntryKey]>>>;
};

function normalizeFormValues(partial?: WatchedFormValues): CaseFormValues {
  return {
    ...DEFAULT_FORM_VALUES,
    ...partial,
    timeEntries: {
      analysis: {
        ...DEFAULT_FORM_VALUES.timeEntries.analysis,
        ...partial?.timeEntries?.analysis,
      },
      communication: {
        ...DEFAULT_FORM_VALUES.timeEntries.communication,
        ...partial?.timeEntries?.communication,
      },
      response: {
        ...DEFAULT_FORM_VALUES.timeEntries.response,
        ...partial?.timeEntries?.response,
      },
    },
  };
}

function App() {
  const [savedCases, setSavedCases] = useState<Record<string, SavedCase>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [persistedTotals, setPersistedTotals] = useState<TotalsSnapshot>(() =>
    getCalculatedTotals(DEFAULT_FORM_VALUES),
  );

  const { control, register, handleSubmit, reset } = useForm<CaseFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

const watchedValues = useWatch({ control });
  const values = normalizeFormValues(watchedValues);
  
  const exchangeRate = values.exchangeRateSekToEur || 0.088;

  useEffect(() => {
    setSavedCases(loadSavedCases());
  }, []);

  const liveTotals = useMemo(
    () =>
      getCalculatedTotals(values, {
        claimInterest: persistedTotals.claimInterest,
        legalInterest: persistedTotals.legalInterest,
      }),
    [persistedTotals.claimInterest, persistedTotals.legalInterest, values],
  );

  const onSave = (formValues: CaseFormValues) => {
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

    const totals = getCalculatedTotals(formValues, {
      claimInterest,
      legalInterest,
    });

    const calculatedAt = new Date().toISOString();
    const savedCase: SavedCase = {
      form: {
        ...formValues,
        ftNumberOfPersons: formValues.caseType === 'FT' ? formValues.ftNumberOfPersons : '',
      },
      calculatedAt,
      annualInterestRate: formValues.annualInterestRate,
      totals,
    };

    saveCaseToStorage(formValues.caseNumber, savedCase);
    setSavedCases(loadSavedCases());
    setPersistedTotals(totals);
    setLastSavedAt(calculatedAt);
  };

  const loadCase = (caseKey: string) => {
    const saved = savedCases[caseKey];
    if (!saved) {
      return;
    }

    reset(saved.form);
    setPersistedTotals(saved.totals);
    setLastSavedAt(saved.calculatedAt);
  };

  const currentHourlyRate = getHourlyRate(values.partyType);
  const currentVatRate = getVatRate(values.partyType);

  return (
    <div className="app-shell">
      <main className="page">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Legal Claim Calculator</p>
            <h1>LexBill kostnadsräkning</h1>
            <p className="hero-copy">
              Beräkna yrkanden, rättsliga kostnader, ränta och skapa en PDF-rapport i svensk
              kostnadsräkningsstil.
            </p>
          </div>
          <div className="hero-meta">
            <span>Timkostnad: {formatCurrency(currentHourlyRate)}</span>
            <span>Moms: {(currentVatRate * 100).toFixed(0)}%</span>
            <span>Räntesats: {((values.annualInterestRate || 0) * 100).toFixed(2)}%</span>
            <span>EUR Kurs: {exchangeRate.toFixed(4)}</span>
          </div>
        </section>

        <div className="content-grid">
          <form className="form-panel" onSubmit={handleSubmit(onSave)}>
            <section className="panel">
              <div className="section-heading">
                <h2>Ärende</h2>
                <p>Grunduppgifter för målet och vilket regelverk som ska tillämpas.</p>
              </div>
              <div className="grid two">
                <label>
                  <span>Mål.nr</span>
                  <input {...register('caseNumber')} placeholder="T 1234-26" />
                </label>
                <label>
                  <span>Internt referensnummer</span>
                  <input {...register('internalReference')} placeholder="LEX-2026-001" />
                </label>
                <label>
                  <span>Partstyp</span>
                  <select {...register('partyType')}>
                    <option value="PRIVATE_PERSON">Private person</option>
                    <option value="FR">FR (Flightright)</option>
                  </select>
                </label>
                <label>
                  <span>Ärendetyp</span>
                  <select {...register('caseType')}>
                    <option value="FT">FT</option>
                    <option value="OT">OT</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Fordran</h2>
                <p>Tomma fält räknas automatiskt som 0.</p>
              </div>
              <div className="grid two">
                <label>
                  <span>Kompensation</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register('compensation', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                      placeholder="0"
                      style={{ flex: 1 }}
                    />
                    <select {...register('compensationCurrency')} style={{ width: '90px' }}>
                      <option value="EUR">EUR</option>
                      <option value="SEK">SEK</option>
                    </select>
                  </div>
                </label>
                <label>
                  <span>Extra utgifter</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register('extraExpenses', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                      placeholder="0"
                      style={{ flex: 1 }}
                    />
                    <select {...register('extraExpensesCurrency')} style={{ width: '90px' }}>
                      <option value="EUR">EUR</option>
                      <option value="SEK">SEK</option>
                    </select>
                  </div>
                </label>
                <label className="readonly-field">
                  <span>Kapitalbelopp</span>
                  <output>{formatCurrency(liveTotals.claimAmount, 'EUR')}</output>
                </label>
                <label>
                  <span>Ansökningsavgift</span>
                  <input
                    type="number"
                    step="0.01"
                    {...register('courtFee', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span>Årlig räntesats (decimalform)</span>
                  <input
                    type="number"
                    step="0.01"
                    {...register('annualInterestRate', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                  />
                </label>
                <label>
                  <span>SEK till EUR Växelkurs</span>
                  <input
                    type="number"
                    step="0.0001"
                    {...register('exchangeRateSekToEur', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                  />
                </label>
                <label>
                  <span>Ränta startdatum för fordran</span>
                  <input type="date" {...register('claimInterestStartDate')} />
                </label>
                <label>
                  <span>
                    Ränta startdatum för{' '}
                    {values.caseType === 'FT' ? 'legal cost + court fee' : 'legal costs'}
                  </span>
                  <input type="date" {...register('legalInterestStartDate')} />
                </label>
              </div>
            </section>

            {values.caseType === 'FT' ? (
              <section className="panel">
                <div className="section-heading">
                  <h2>FT-kostnader</h2>
                  <p>Beräknas automatiskt (1982.5 kr × antal personer).</p>
                </div>
                <div className="grid one">
                  <label>
                    <span>Antal personer</span>
                    <input
                      type="number"
                      step="1"
                      {...register('ftNumberOfPersons', { setValueAs: (value) => (value === '' ? '' : Number(value)) })}
                      placeholder="0"
                    />
                  </label>
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="section-heading">
                  <h2>OT-kostnader</h2>
                  <p>Tidsposter med automatiskt timpris och separat procentsatsrad.</p>
                </div>
                <div className="time-entry-table">
                  <div className="time-entry header">
                    <span>Post</span>
                    <span>Timmar</span>
                    <span>Minuter</span>
                    <span>Timpris</span>
                    <span>Belopp</span>
                  </div>
                  {(Object.keys(TIME_ENTRY_LABELS) as TimeEntryKey[]).map((key) => {
                    const entry = values.timeEntries[key];
                    const rowTotal = getTimeEntryTotal(entry.hours, entry.minutes, currentHourlyRate);

                    return (
                      <div className="time-entry" key={key}>
                        <span>{TIME_ENTRY_LABELS[key]}</span>
                        <Controller
                          control={control}
                          name={`timeEntries.${key}.hours`}
                          render={({ field }) => (
                            <select
                              value={field.value}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                            >
                              {HOUR_OPTIONS.map((hour) => (
                                <option key={hour} value={hour}>
                                  {hour}
                                </option>
                              ))}
                            </select>
                          )}
                        />
                        <Controller
                          control={control}
                          name={`timeEntries.${key}.minutes`}
                          render={({ field }) => (
                            <select
                              value={field.value}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                            >
                              {MINUTE_OPTIONS.map((minute) => (
                                <option key={minute} value={minute}>
                                  {minute}
                                </option>
                              ))}
                            </select>
                          )}
                        />
                        <span>{formatCurrency(currentHourlyRate)}</span>
                        <strong>{formatCurrency(rowTotal)}</strong>
                      </div>
                    );
                  })}
                </div>

                <div className="grid two compact-top">
                  <label className="readonly-field">
                    <span>Ombudsarvode enligt fast procentsats</span>
                    <output>{formatCurrency(liveTotals.percentageFee, 'EUR')}</output>
                  </label>
                  <label className="readonly-field">
                    <span>Tidsarvode</span>
                    <output>{formatCurrency(liveTotals.timeEntriesTotal)}</output>
                  </label>
                </div>
              </section>
            )}

            <section className="panel action-row">
              <div className="saved-cases">
                <label>
                  <span>Sparade ärenden</span>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) {
                        loadCase(event.target.value);
                      }
                    }}
                  >
                    <option value="">Välj sparat ärende</option>
                    {Object.keys(savedCases).map((caseKey) => (
                      <option key={caseKey} value={caseKey}>
                        {caseKey}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="primary-button">
                  Save
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    generateCostReportPdf(
                      values,
                      liveTotals,
                      lastSavedAt || new Date().toISOString(),
                    )
                  }
                >
                  Generate PDF
                </button>
              </div>
            </section>
          </form>

          <aside className="summary-panel">
            <section className="panel sticky">
              <div className="section-heading">
                <h2>Live Summary</h2>
                <p>Ränta uppdateras när du klickar på Save.</p>
              </div>

              <dl className="summary-list">
                <div>
                  <dt>Mål.nr</dt>
                  <dd>{values.caseNumber || '-'}</dd>
                </div>
                <div>
                  <dt>Referens</dt>
                  <dd>{values.internalReference || '-'}</dd>
                </div>
                <div>
                  <dt>Partstyp</dt>
                  <dd>{values.partyType === 'FR' ? 'FR' : 'Private person'}</dd>
                </div>
                <div>
                  <dt>Ärendetyp</dt>
                  <dd>{values.caseType}</dd>
                </div>
                <div>
                  <dt>Kapitalbelopp</dt>
                  <dd>{formatCurrency(liveTotals.claimAmount, 'EUR')}</dd>
                </div>
                <div>
                  <dt>Timkostnad</dt>
                  <dd>{formatCurrency(liveTotals.hourlyRate)}</dd>
                </div>
                <div>
                  <dt>Moms</dt>
                  <dd>{formatCurrency(liveTotals.vatAmount)}</dd>
                </div>
                <div>
                  <dt>Ränta på fordran</dt>
                  <dd>{formatCurrency(liveTotals.claimInterest)}</dd>
                </div>
                <div>
                  <dt>Ränta på kostnader</dt>
                  <dd>{formatCurrency(liveTotals.legalInterest)}</dd>
                </div>
              </dl>

              {values.caseType === 'OT' && (
                <div className="ot-breakdown">
                  <h3>OT-underlag</h3>
                  {(Object.keys(TIME_ENTRY_LABELS) as TimeEntryKey[]).map((key) => {
                    const entry = values.timeEntries[key];
                    return (
                      <div key={key} className="mini-row">
                        <span>{TIME_ENTRY_LABELS[key]}</span>
                        <span>
                          {getTimeEntryHours(entry.hours, entry.minutes).toFixed(2)} h /{' '}
                          {formatCurrency(
                            getTimeEntryTotal(entry.hours, entry.minutes, liveTotals.hourlyRate),
                          )}
                        </span>
                      </div>
                    );
                  })}
                  <div className="mini-row emphasis">
                    <span>45% procentsats</span>
                    <span>{formatCurrency(liveTotals.percentageFee, 'EUR')}</span>
                  </div>
                </div>
              )}

              <div className="total-card">
                <span>Totalt att yrka</span>
                <strong>{formatCurrency(liveTotals.grandTotal)}</strong>
                <small>Senast sparad: {lastSavedAt ? formatDate(lastSavedAt) : 'Inte sparad än'}</small>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
