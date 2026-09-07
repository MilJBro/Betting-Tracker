import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { formatDate } from '../format.js';

export default function ProfitChart({ timeline, primary = '#22c55e', height = 260 }) {
  if (!timeline || timeline.length === 0) {
    return <div className="empty">No settled bets yet — your profit curve will appear here.</div>;
  }
  // Index points so repeated dates still render distinctly.
  const data = timeline.map((p, i) => ({ ...p, i }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="pfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="i"
          tickFormatter={(i) => formatDate(data[i]?.date)}
          stroke="var(--muted)"
          fontSize={11}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
          }}
          labelFormatter={(i) => formatDate(data[i]?.date)}
          formatter={(v) => [v, 'Cumulative profit']}
        />
        <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="profit"
          stroke={primary}
          strokeWidth={2.5}
          fill="url(#pfill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
