import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Published-results charts.
 *
 * Values are already aggregated and small-cell suppressed. The dashboard also
 * renders a text equivalent for each chart so results remain accessible.
 */

const SERIES = [
  { code: 'HTS_TST', color: '#0f6b3f' },
  { code: 'HTS_TST_POS', color: '#e07a2d' },
  { code: 'HTS_REF', color: '#2878b5' },
  { code: 'HTS_LINK', color: '#7655b5' },
];

function ChartTooltip({ active, payload, label, nameFor, t }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-40 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <ul className="space-y-1.5">
        {payload
          .filter((item) => item.value !== undefined && item.value !== null)
          .map((item) => (
            <li key={item.dataKey} className="flex items-center justify-between gap-5 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || item.fill }}
                />
                <span className="truncate">
                  {item.payload?.name || item.name || nameFor(item.dataKey)}
                </span>
              </span>
              <span className="font-bold tabular-nums text-ink">
                {Number(item.value).toLocaleString()}
              </span>
            </li>
          ))}
      </ul>
      <span className="sr-only">{t('dashboard.chartValue')}</span>
    </div>
  );
}

export function IndicatorBarChart({ rows, t }) {
  const data = rows.map((row) => ({
    code: row.indicator_code,
    name: row.indicator_name || row.indicator_code,
    value: row.value,
  }));

  if (data.length === 0) return null;

  const nameFor = (code) => data.find((item) => item.code === code)?.name || code;

  return (
    <div className="h-72 w-full" role="img" aria-label={t('dashboard.barTitle')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 42, bottom: 8, left: 4 }}
          barCategoryGap="28%"
        >
          <defs>
            <linearGradient id="indicatorBarGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0f6b3f" />
              <stop offset="100%" stopColor="#43a877" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(value) => Number(value).toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="code"
            width={86}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9', radius: 8 }}
            content={<ChartTooltip nameFor={nameFor} t={t} />}
          />
          <Bar
            dataKey="value"
            name={t('dashboard.chartValue')}
            fill="url(#indicatorBarGradient)"
            radius={[0, 7, 7, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => Number(value).toLocaleString()}
              className="fill-slate-600 text-[11px] font-semibold"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ periods, indicators, trend, t }) {
  const availableCodes = new Set(trend.map((row) => row.indicator_code));
  const preferredCodes = SERIES.map(({ code }) => code).filter((code) => availableCodes.has(code));
  const codes = (preferredCodes.length > 0
    ? preferredCodes
    : indicators.filter((indicator) => availableCodes.has(indicator.code)).map(({ code }) => code)
  ).slice(0, SERIES.length);

  if (codes.length === 0 || periods.length === 0) return null;

  const data = periods.map((period) => {
    const point = { period };
    for (const code of codes) {
      const row = trend.find((item) => item.period === period && item.indicator_code === code);
      if (row) point[code] = row.value;
    }
    return point;
  });

  const nameFor = (code) =>
    indicators.find((indicator) => indicator.code === code)?.name || code;

  return (
    <div className="h-72 w-full" role="img" aria-label={t('dashboard.trendTitle')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickMargin={10}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(value) => Number(value).toLocaleString()}
          />
          <Tooltip content={<ChartTooltip nameFor={nameFor} t={t} />} />
          <Legend
            formatter={(code) => nameFor(code)}
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          />
          {codes.map((code) => {
            const color = SERIES.find((series) => series.code === code)?.color || '#64748b';
            return (
              <Line
                key={code}
                type="monotone"
                dataKey={code}
                name={nameFor(code)}
                stroke={color}
                strokeWidth={2.5}
                activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
