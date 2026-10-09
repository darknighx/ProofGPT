import { useId } from 'react';
import { classificationColors, type DistributionEntry, type TrendPoint } from '../services/reportService';

export function ReportDistribution({ entries, total }: { entries: DistributionEntry[]; total: number }) {
  const labelId = useId();
  let cumulative = 0;
  const circumference = 2 * Math.PI * 75;
  return <section className="report-panel report-distribution" aria-labelledby={labelId}>
    <h2 id={labelId}>Result Distribution</h2>
    {total ? <div className="report-distribution-body">
      <svg className="report-donut" viewBox="0 0 200 200" role="img" aria-label={`Classification distribution for ${total} analyses: ${entries.map((entry) => `${entry.classification} ${entry.count}`).join(', ')}`}>
        <circle cx="100" cy="100" r="75" fill="none" stroke="#242d42" strokeWidth="30" />
        {entries.map((entry) => {
          const offset = cumulative; cumulative += entry.count / total * circumference;
          return entry.count > 0 ? <circle key={entry.classification} cx="100" cy="100" r="75" fill="none" stroke={classificationColors[entry.classification]} strokeWidth="30"
            strokeDasharray={`${entry.count / total * circumference} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)">
            <title>{entry.classification}: {entry.count} ({entry.percentage}%)</title></circle> : null;
        })}
        <text x="100" y="99" textAnchor="middle" className="donut-count">{total}</text>
        <text x="100" y="123" textAnchor="middle" className="donut-caption">Analyses</text>
      </svg>
      <ul className="report-legend">{entries.map((entry) => <li key={entry.classification}><span className="report-legend-dot" style={{ backgroundColor: classificationColors[entry.classification] }} /><div><span>{entry.classification}</span><strong>{entry.count} ({entry.percentage}%)</strong></div></li>)}</ul>
    </div> : <p className="report-chart-empty">No analyses in this selection.</p>}
  </section>;
}

export function ReportTrend({ points, onOpen }: { points: TrendPoint[]; onOpen: (id: string) => void }) {
  const labelId = useId();
  const gradientId = useId().replace(/:/g, '');
  const width = Math.max(320, points.length * 25 + 48);
  const left = 38, right = width - 10, top = 12, bottom = 122;
  const step = (right - left) / Math.max(points.length, 1);
  const barWidth = Math.min(22, step * .45);
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return <section className="report-panel report-trend" aria-labelledby={labelId}>
    <h2 id={labelId}>AI Probability Overview</h2>
    {points.length ? <>
      <div className="report-chart-scroll">
        <svg viewBox={`0 0 ${width} 148`} className="report-bar-chart" style={{ minWidth: points.length > 12 ? width : undefined }} role="group" aria-label="AI probability over time, oldest to newest">
          <defs>{Object.entries(classificationColors).map(([classification, color], index) => <linearGradient key={classification} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".7" /></linearGradient>)}</defs>
          {[0, 25, 50, 75, 100].map((value) => {
            const y = bottom - value / 100 * (bottom - top);
            return <g key={value}><line x1={left} y1={y} x2={right} y2={y} className="report-chart-grid" /><text x={left - 9} y={y + 4} textAnchor="end" className="report-chart-label">{value}%</text></g>;
          })}
          {points.map((point, index) => {
            const x = left + (index + .5) * step;
            const height = point.aiProbability / 100 * (bottom - top);
            const date = new Date(point.analyzedAt);
            const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const description = `${date.toLocaleString('en-US')}: ${point.aiProbability}% AI, ${point.classification}`;
            const tone = Object.keys(classificationColors).indexOf(point.classification);
            return <g key={point.id} className="report-trend-point" data-record-id={point.id} data-probability={point.aiProbability} role="button" tabIndex={0} aria-label={`Open analysis from ${description}`}
              onClick={() => onOpen(point.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(point.id); } }}>
              <title>{description}</title><rect x={x - step / 2} y={top} width={step} height={bottom - top} fill="transparent" />
              <rect x={x - barWidth / 2} y={bottom - height} width={barWidth} height={height} fill={`url(#${gradientId}-${tone})`} />
              <circle cx={x} cy={bottom - height} r="2" fill={classificationColors[point.classification]} />
              {(index % labelEvery === 0 || (index === points.length - 1 && index % labelEvery >= labelEvery / 2)) && <text x={x} y={bottom + 22} textAnchor="middle" className="report-chart-label">{dateLabel}</text>}
            </g>;
          })}
        </svg>
      </div>
    </> : <p className="report-chart-empty">No analyses in this selection.</p>}
  </section>;
}
