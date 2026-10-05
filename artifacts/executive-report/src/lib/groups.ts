import type { Visit } from '@workspace/api-client-react';
import { normName } from '@/lib/analytics';

export interface Group {
  key: string; name: string; n: number; accounts: number; reps: number;
  latest: Visit; closing: number; topType: string;
}
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const newer = (a: Visit, b: Visit) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.sourceRow - b.sourceRow;

export function groupVisits(vs: Visit[], f: (v: Visit) => string, blank = '(blank)'): Group[] {
  const m = new Map<string, Visit[]>();
  for (const v of vs) { const k = normName(f(v)); m.set(k, [...(m.get(k) ?? []), v]); }
  return [...m.entries()].map(([key, list]) => {
    const names = new Map<string, number>();
    const types = new Map<string, number>();
    for (const v of list) {
      const nm = clean(f(v)); names.set(nm, (names.get(nm) ?? 0) + 1);
      const t = clean(v.activityType); types.set(t, (types.get(t) ?? 0) + 1);
    }
    const top = (x: Map<string, number>) => [...x.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const latest = [...list].sort((a, b) => newer(b, a))[0];
    return {
      key, name: top(names) || blank, n: list.length,
      accounts: new Set(list.map((v) => normName(v.company))).size,
      reps: new Set(list.map((v) => normName(v.salesName))).size,
      latest, closing: list.filter((v) => /closing/i.test(v.activityType)).length, topType: top(types),
    };
  }).sort((a, b) => b.n - a.n || newer(b.latest, a.latest));
}
