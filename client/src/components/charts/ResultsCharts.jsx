import {
  Bar,
  BarChart,
  CartesianGrid,
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
 * The numbers arrive already aggregated and small-cell suppressed, so these
 * components only draw what the API sends. Every chart is paired with a text
 * list or table by the caller so the same information is reachable without
 * seeing colour or a pointer.
 */

const COLORS = ['#0f6b3f', '#278a60', '#48a67c', '#7cc3a1', '#0a452a'];

export function IndicatorBarChart({ rows, t }) {
  const data = rows.map((row) => ({
    code: row.indicator_code,
    name: row.indicator_name || row.indicator_code,
    value: row.value,
  }));

  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
          <YAxis
            type="category"
            dataKey="code"
            width={88}
            tick={{ fontSize: 12, fill: '#475569' }}
          />
          <Tooltip
            formatter={(value, _name, item) => [value, item?.payload?.name || t('dashboard.chartValue')]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="value" fill="#0f6b3f" radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ periods, indicators, trend, t }) {
  const codes = indicators
    .filter((indicator) => trend.some((row) => row.indicator_code === indicator.code))
    .map((indicator) => indicator.code)
    .slice(0, COLORS.length);

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
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#475569' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
          <Tooltip formatter={(value, code) => [value, nameFor(code)]} />
          <Legend formatter={(code) => nameFor(code)} wrapperStyle={{ fontSize: 12 }} />
          {codes.map((code, index) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              stroke={COLORS[index]}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
