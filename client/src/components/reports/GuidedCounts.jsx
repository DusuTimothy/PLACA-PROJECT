import { entryKey, groupProgress, indicatorGroups, sexKey, ageKey, TOTAL_KEY } from './guidedCounts';
import FieldHint from '../guides/FieldHint';

/**
 * Paper-style count entry: one numbered block per indicator, total first,
 * then sex and age groups in the same order as the printed form.
 *
 * Every field is a plain number input so it works with a numeric keypad, a
 * mouse and a screen reader. Problems appear under the block they belong to.
 */

// Field hints are written by PLACA officers against a friendly key, not the
// indicator code. This map connects the two without changing stored data.
const HINT_KEYS = {
  HTS_TST: 'persons_tested',
  HTS_TST_POS: 'persons_positive',
  REACH: 'people_reached',
  CONDOM_DIST: 'condoms_distributed',
  TRAINING_PARTICIPANTS: 'people_trained',
};

function NumberField({ id, label, value, onChange, describedBy, emphasis = false }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        placeholder="0"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
        className={`placa-input mt-1 text-right tabular-nums ${
          emphasis ? 'h-12 text-xl font-bold' : 'h-11 text-base font-semibold'
        }`}
      />
    </div>
  );
}

function Progress({ done, total, t }) {
  if (total === 0) return null;
  const complete = done === total;
  return (
    <p className={`mt-1 text-sm ${complete ? 'font-semibold text-green-800' : 'text-slate-600'}`}>
      {complete && (
        <span aria-hidden="true" className="mr-1">
          ✓
        </span>
      )}
      {t('reports.rowsFilled', { done, total })}
    </p>
  );
}

function IndicatorBlock({ indicator, number, entries, setEntries, issues, t }) {
  const { sex, age } = indicatorGroups(indicator);
  const hasGroups = sex.length > 0 || age.length > 0;
  const errorId = `issues-${indicator.id}`;
  const describedBy = issues?.length ? errorId : undefined;
  const totalKey = entryKey(indicator.id, TOTAL_KEY);

  const sexProgress = groupProgress(sex, entries, indicator.id, sexKey);
  const ageProgress = groupProgress(age, entries, indicator.id, ageKey);

  function update(key, value) {
    setEntries((current) => ({ ...current, [entryKey(indicator.id, key)]: value }));
  }

  return (
    <fieldset
      className={`rounded-xl border p-4 ${
        issues?.length ? 'border-red-300 bg-red-50/40' : 'border-slate-200'
      }`}
    >
      <legend className="px-1 text-base font-bold text-ink">
        <span
          aria-hidden="true"
          className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-placa-100 px-1 text-xs font-black text-placa-800"
        >
          {number}
        </span>
        {indicator.name}
      </legend>

      <p className="text-sm leading-relaxed text-slate-600">
        {indicator.plain_language_definition}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {indicator.code} · {t(`units.${indicator.unit}`, { defaultValue: indicator.unit })}
      </p>

      <div className="mt-3 max-w-[12rem]">
        <NumberField
          id={`total-${indicator.id}`}
          label={t('reports.total')}
          value={entries[totalKey]}
          onChange={(value) => update(TOTAL_KEY, value)}
          describedBy={describedBy}
          emphasis
        />
      </div>

      {HINT_KEYS[indicator.code] && (
        <div className="mt-2 max-w-xl">
          <FieldHint
            pageKey="report"
            fieldKey={HINT_KEYS[indicator.code]}
            label={t('phase5.hints.open')}
          />
        </div>
      )}

      {hasGroups && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          {sex.length > 0 && (
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-placa-800">
                {t('reports.sexLabel')}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {sex.map((group) => (
                  <NumberField
                    key={group}
                    id={`sex-${indicator.id}-${group}`}
                    label={t(`reports.sex.${group}`, { defaultValue: group })}
                    value={entries[entryKey(indicator.id, sexKey(group))]}
                    onChange={(value) => update(sexKey(group), value)}
                    describedBy={describedBy}
                  />
                ))}
              </div>
              <Progress done={sexProgress.done} total={sexProgress.total} t={t} />
            </div>
          )}

          {age.length > 0 && (
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-placa-800">
                {t('reports.ageLabel')}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {age.map((group) => (
                  <NumberField
                    key={group}
                    id={`age-${indicator.id}-${group}`}
                    label={t('reports.ageBand', { range: group })}
                    value={entries[entryKey(indicator.id, ageKey(group))]}
                    onChange={(value) => update(ageKey(group), value)}
                    describedBy={describedBy}
                  />
                ))}
              </div>
              <Progress done={ageProgress.done} total={ageProgress.total} t={t} />
            </div>
          )}
        </div>
      )}

      {issues?.length > 0 && (
        <ul
          id={errorId}
          role="alert"
          className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900"
        >
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export default function GuidedCounts({ groupedIndicators, entries, setEntries, issuesByIndicator, t }) {
  return (
    <div className="space-y-6">
      {groupedIndicators.map(([category, items]) => (
        <section key={category} aria-labelledby={`category-${category}`}>
          <h3
            id={`category-${category}`}
            className="text-sm font-bold uppercase tracking-wide text-placa-800"
          >
            {t(`categories.${category}`)}
          </h3>
          <div className="mt-3 space-y-3">
            {items.map((indicator, index) => (
              <IndicatorBlock
                key={indicator.id}
                indicator={indicator}
                number={index + 1}
                entries={entries}
                setEntries={setEntries}
                issues={issuesByIndicator.get(indicator.id)}
                t={t}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
