// Small hand-rolled SVG charts. Merit and demerit use a CVD-validated
// blue/brick pair and also differ by position (above vs below zero).
import { useState, type ReactNode } from 'react';
import type { SeriesPoint } from '../lib/logic';

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const el = tip ? <div className="tip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 230), top: tip.y + 12 }}>{tip.body}</div> : null;
  return { el, show: (e: React.PointerEvent, body: ReactNode) => setTip({ x: e.clientX, y: e.clientY, body }), hide: () => setTip(null) };
}

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Merit above zero, demerit below, one pair per bucket. */
export function DivergingBars({ data, height = 200, unit = 'pts' }: { data: SeriesPoint[]; height?: number; unit?: string }) {
  const tip = useTip();
  const W = 640, padL = 32, padR = 8, padT = 10, padB = 24;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.merit, d.demerit))));
  const minV = niceMax(Math.max(1, ...data.map((d) => d.demerit)));
  const lo = Math.min(max, Math.max(minV, max / 2));
  const plotH = height - padT - padB;
  const y = (v: number) => padT + ((max - v) / (max + lo)) * plotH;
  const bw = (W - padL - padR) / data.length;
  const barW = Math.max(4, Math.min(28, bw * 0.55));
  const labelEvery = Math.ceil(data.length / 12);
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Merit versus demerit points, ${data.length} periods`}>
        {[max, max / 2, -lo].map((v) => (
          <g key={v}>
            <line className="gridline" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end">{v > 0 ? v : `−${Math.abs(v)}`}</text>
          </g>
        ))}
        <line className="zero" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />
        {data.map((d, i) => {
          const cx = padL + bw * i + bw / 2;
          const mh = y(0) - y(d.merit);
          const dh = y(-d.demerit) - y(0);
          return (
            <g key={d.key}>
              {d.merit > 0 && <path d={roundTop(cx - barW / 2, y(d.merit), barW, mh - 1)} fill="var(--merit)" />}
              {d.demerit > 0 && <path d={roundBottom(cx - barW / 2, y(0) + 1, barW, dh - 1)} fill="var(--demerit)" />}
              {i % labelEvery === 0 && <text x={cx} y={height - 6} textAnchor="middle">{d.label}</text>}
              <rect className="hit" x={padL + bw * i} y={padT} width={bw} height={plotH}
                onPointerMove={(e) => tip.show(e, <><b>{d.label}</b><br />Merit +{d.merit} {unit}<br />Demerit −{d.demerit} {unit}<br />Net {d.net >= 0 ? '+' : '−'}{Math.abs(d.net)}</>)}
                onPointerLeave={tip.hide} />
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--merit)' }} />Merit (above line)</span><span><i style={{ background: 'var(--demerit)' }} />Demerit (below line)</span></div>
      {tip.el}
    </div>
  );
}

function roundTop(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}
function roundBottom(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y}V${y + h - r}Q${x} ${y + h} ${x + r} ${y + h}H${x + w - r}Q${x + w} ${y + h} ${x + w} ${y + h - r}V${y}Z`;
}

/** A single series over time with a crosshair tooltip. */
export function LineChart({ points, height = 180, label, format = (v: number) => String(v), color = 'var(--chart)' }: {
  points: { label: string; value: number }[]; height?: number; label: string; format?: (v: number) => string; color?: string;
}) {
  const tip = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, padL = 40, padR = 12, padT = 12, padB = 24;
  const vals = points.map((p) => p.value);
  const hi = niceMax(Math.max(1, ...vals));
  const lo = Math.min(0, ...vals) < 0 ? -niceMax(-Math.min(...vals)) : 0;
  const x = (i: number) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (height - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join('');
  const labelEvery = Math.ceil(points.length / 8);
  const last = points.length - 1;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.max(0, Math.min(last, Math.round(((px - padL) / (W - padL - padR)) * last)));
          setHover(i);
          tip.show(e, <><b>{points[i].label}</b><br />{format(points[i].value)}</>);
        }}
        onPointerLeave={() => { setHover(null); tip.hide(); }}>
        {[hi, hi / 2, lo].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
          <g key={v}><line className="gridline" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} /><text x={padL - 6} y={y(v) + 4} textAnchor="end">{format(v)}</text></g>
        ))}
        {lo < 0 && <line className="zero" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => i % labelEvery === 0 && <text key={i} x={x(i)} y={height - 6} textAnchor="middle">{p.label}</text>)}
        {hover !== null && <><line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke="var(--border)" /><circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill={color} stroke="var(--card)" strokeWidth={2} /></>}
        {last >= 0 && <><circle cx={x(last)} cy={y(points[last].value)} r={4} fill={color} stroke="var(--card)" strokeWidth={2} /><text x={x(last) - 6} y={y(points[last].value) - 10} textAnchor="end" style={{ fill: 'var(--text)', fontWeight: 700 }}>{format(points[last].value)}</text></>}
      </svg>
      {tip.el}
    </div>
  );
}

/** Category rows: merit and demerit segments side by side on one scale. */
export function CategoryBars({ rows }: { rows: { category: string; merit: number; demerit: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.merit + r.demerit));
  return (
    <div>
      {rows.slice(0, 8).map((r) => (
        <div className="hbar" key={r.category} title={`${r.category}: +${r.merit} / −${r.demerit}`}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</span>
          <div className="track">
            {r.merit > 0 && <span style={{ width: `${(r.merit / max) * 100}%`, background: 'var(--merit)' }} />}
            {r.demerit > 0 && <span style={{ width: `${(r.demerit / max) * 100}%`, background: 'var(--demerit)' }} />}
          </div>
          <span className="num" style={{ textAlign: 'right', fontSize: 16 }}>{r.merit - r.demerit >= 0 ? '+' : '−'}{Math.abs(r.merit - r.demerit)}</span>
        </div>
      ))}
      <div className="legend"><span><i style={{ background: 'var(--merit)' }} />Merit</span><span><i style={{ background: 'var(--demerit)' }} />Demerit</span><span>Number = net</span></div>
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null;
  const hi = Math.max(...values), lo = Math.min(...values);
  const span = hi - lo || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, values.length - 1)) * (width - 4) + 2} ${height - 2 - ((v - lo) / span) * (height - 4)}`).join('');
  return <svg width={width} height={height} aria-hidden="true"><path d={d} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" /></svg>;
}

/** Spending by category as horizontal bars in one hue (magnitude). */
export function AmountBars({ rows, currency }: { rows: { category: string; amount: number }[]; currency: string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div>
      {rows.slice(0, 8).map((r) => (
        <div className="hbar" key={r.category} style={{ gridTemplateColumns: '100px 1fr 72px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</span>
          <div className="track"><span style={{ width: `${(r.amount / max) * 100}%`, background: 'var(--merit)' }} /></div>
          <span className="num" style={{ textAlign: 'right', fontSize: 15 }}>{currency} {Math.round(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}
