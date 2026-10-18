/**
 * Datas: armazenamento sempre em UTC (ISO-8601), apresentação em America/Sao_Paulo.
 * Funções puras e independentes do fuso da máquina (testadas em time.test.ts).
 */
import type { IsoUtc } from './types';

export const APP_TIME_ZONE = 'America/Sao_Paulo';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(date: Date): WallClock {
  const map: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: (map.hour ?? 0) % 24,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

/** Minutos a somar ao UTC para obter o horário de parede no fuso da aplicação. */
export function tzOffsetMinutes(date: Date): number {
  const w = wallClock(date);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

export function isValidIso(iso: string | null | undefined): iso is IsoUtc {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t);
}

/** "18/10/2026 14:32" */
export function formatDateTime(iso: IsoUtc | null | undefined, withSeconds = false): string {
  if (!isValidIso(iso)) return '—';
  const w = wallClock(new Date(iso));
  const base = `${pad(w.day)}/${pad(w.month)}/${w.year} ${pad(w.hour)}:${pad(w.minute)}`;
  return withSeconds ? `${base}:${pad(w.second)}` : base;
}

export function formatDate(iso: IsoUtc | null | undefined): string {
  if (!isValidIso(iso)) return '—';
  const w = wallClock(new Date(iso));
  return `${pad(w.day)}/${pad(w.month)}/${w.year}`;
}

export function formatTime(iso: IsoUtc | null | undefined): string {
  if (!isValidIso(iso)) return '—';
  const w = wallClock(new Date(iso));
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** Valor para <input type="datetime-local"> no fuso da aplicação. */
export function toLocalInputValue(iso: IsoUtc | null | undefined): string {
  if (!isValidIso(iso)) return '';
  const w = wallClock(new Date(iso));
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** Converte "YYYY-MM-DDTHH:mm" (horário de parede em São Paulo) para ISO UTC. */
export function fromLocalInputValue(value: string): IsoUtc | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  let offset = tzOffsetMinutes(new Date(guess));
  let ts = guess - offset * 60000;
  const offset2 = tzOffsetMinutes(new Date(ts));
  if (offset2 !== offset) {
    offset = offset2;
    ts = guess - offset * 60000;
  }
  const result = new Date(ts);
  // Rejeita datas inexistentes (ex.: 31/02) que o Date normalizaria silenciosamente.
  if (toLocalInputValue(result.toISOString()).slice(0, 16) !== value.trim().slice(0, 16)) return null;
  return result.toISOString();
}

/** Início do dia corrente (00:00 em São Paulo) em ISO UTC. */
export function startOfLocalDay(now: Date): IsoUtc {
  const w = wallClock(now);
  return fromLocalInputValue(`${w.year}-${pad(w.month)}-${pad(w.day)}T00:00`) ?? now.toISOString();
}

export function diffMinutes(fromIso: IsoUtc, toIso: IsoUtc): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 60000;
}

/** 7 → "7 min"; 65 → "1 h 05 min"; valores negativos são exibidos como inconsistentes. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return 'Sem dados';
  if (minutes < 0) return 'Inconsistente';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${pad(m)} min`;
}

/** "há 5 min", "há 2 h" — usado em feeds. */
export function formatRelative(iso: IsoUtc, now: Date): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function addMinutes(iso: IsoUtc, minutes: number): IsoUtc {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}
