import type { ReactNode } from 'react';
import { deltaText, fmtDate, type Delta } from '@/lib/analytics';

export type ViewId = 'overview' | 'register' | 'reps' | 'companies' | 'commodities' | 'heatmap' | 'brief';
export interface RegFilter {
  term: string; type: string;
  field?: 'salesName' | 'company' | 'commodity';
  value?: string;
  start?: string;
  end?: string;
}
export type Drill = (f: Partial<RegFilter>) => void;

export const stamp = (s: string) =>
  s.length === 10 ? `${fmtDate(s)} (date only)` : new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const covText = { full: 'Within recorded date span', partial: 'Partly outside recorded date span', none: 'Outside recorded date span' } as const;
export const PIE_COLORS = ['hsl(217 91% 62%)', 'hsl(45 85% 58%)', 'hsl(6 70% 56%)', 'hsl(142 45% 50%)', 'hsl(187 62% 50%)', 'hsl(28 90% 56%)', 'hsl(280 40% 62%)', 'hsl(215 12% 55%)'];

export function Panel({ title, note, action, children, className = '', id }: { title: string; note?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel min-w-0 p-4 print:break-inside-avoid ${className}`} data-testid={id ? `panel-${id}` : undefined}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {action && <div className="ml-auto print:hidden">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export const Empty = ({ children, id }: { children: ReactNode; id?: string }) => (
  <p className="rounded border border-dashed border-border p-5 text-sm text-muted-foreground" data-testid={id}>{children}</p>
);

export function DeltaTag({ d }: { d: Delta }) {
  const tone = d.kind === 'pct' ? (d.value >= 0 ? 'text-chart-4' : 'text-clay') : d.kind === 'fromZero' ? 'text-chart-4' : 'text-muted-foreground';
  return <span className={`mono text-xs font-medium ${tone}`}>{deltaText(d)}</span>;
}

export function Bar({ pct, prevPct, tone = 'bg-primary' }: { pct: number; prevPct?: number; tone?: string }) {
  return (
    <div className="relative h-2 w-full rounded-sm bg-muted" aria-hidden="true">
      <div className={`growx absolute inset-y-0 left-0 rounded-sm ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      {prevPct !== undefined && <div className="absolute -inset-y-1 w-0.5 bg-ochre" style={{ left: `${Math.min(prevPct, 100)}%` }} />}
    </div>
  );
}

export const DrillBtn = ({ onClick, children, label }: { onClick: () => void; children: ReactNode; label: string }) => (
  <button onClick={onClick} aria-label={label} title={label} className="rounded-sm text-left font-medium underline-offset-4 hover:text-primary hover:underline print:no-underline">{children}</button>
);
