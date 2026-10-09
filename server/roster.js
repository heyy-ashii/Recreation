import { config } from './config.js';
import { AppError } from './utils/AppError.js';

// The signup allow-list lives in a public Google Sheet. A person may create an
// account only when their name and admission number both appear on the same row.
//
//   | AD.NO | NAME                | PHONE | EMAIL |
//   | 3411  | Sayyid Shaham AP    |       |       |
//
// The sheet is exported as CSV, which needs no credentials while it is shared
// "anyone with the link". The raw text is cached briefly so a burst of signups
// does not hammer Google.

export function parseRosterCsv(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const cells = line.split(',').map((c) => c.trim());
    const adNo = cells[0];
    const name = cells[1];
    // Skips the title, the header and trailing blank rows.
    if (!adNo || !name) continue;
    if (/^(ad\.?\s*no\.?|admission)$/i.test(adNo)) continue;
    rows.push({ adNo, name });
  }
  return rows;
}

const normAdNo = (v) => String(v ?? '').trim().toLowerCase().replace(/^u(?=\d)/, '');
const normName = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

let cache = { at: 0, rows: [] };

async function fetchCsv() {
  const url = `https://docs.google.com/spreadsheets/d/${config.roster.sheetId}/export?format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new AppError('Could not read the student list right now. Please try again later.', 503);
  return res.text();
}

export async function loadRoster({ fresh = false } = {}) {
  if (config.roster.csv) return parseRosterCsv(config.roster.csv);
  const ttl = config.roster.cacheMinutes * 60 * 1000;
  if (!fresh && cache.rows.length && Date.now() - cache.at < ttl) return cache.rows;
  const rows = parseRosterCsv(await fetchCsv());
  cache = { at: Date.now(), rows };
  return rows;
}

export async function findStudent(name, admissionNo) {
  const rows = await loadRoster();
  const wantName = normName(name);
  const wantAdNo = normAdNo(admissionNo);
  return rows.find((r) => normName(r.name) === wantName && normAdNo(r.adNo) === wantAdNo) ?? null;
}

// "Muhammed Shamil KT" -> "muhammed.shamil.kt", a valid username for this app
// (lowercase letters, numbers, dot or underscore, 3-30 characters).
export function usernameFromName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30)
    .replace(/^\.+|\.+$/g, '');
}
