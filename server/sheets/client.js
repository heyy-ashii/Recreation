import { config } from '../config.js';
import { AppError } from '../utils/AppError.js';

// Google Apps Script web apps answer a POST with a 302 to script.googleusercontent.com.
// fetch follows it, and Node's redirect drops the body on 301/302, so we re-send it.
async function postJson(url, body) {
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.sheets.timeoutMs),
  });
  if (res.status === 301 || res.status === 302) {
    const location = res.headers.get('location');
    if (location) {
      res = await fetch(location, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.sheets.timeoutMs),
      });
    }
  }
  return res;
}

async function request(action, params = {}, data) {
  const url = new URL(config.sheets.apiUrl);
  url.searchParams.set('token', config.sheets.apiToken);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  let res;
  try {
    res = data
      ? await postJson(url.toString(), { action, ...data })
      : await fetch(url.toString(), { signal: AbortSignal.timeout(config.sheets.timeoutMs) });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new AppError('The Google Sheet timed out. Please try again.', 503);
    }
    throw new AppError('Could not reach the Google Sheet.', 503);
  }

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new AppError('The Google Sheet returned an unexpected response.', 502);
  }

  if (payload.error) {
    if (payload.error === 'Unauthorized') throw new AppError('The Google Sheet rejected our credentials.', 502);
    if (payload.error === 'Program not found') throw new AppError('Program not found', 404);
    throw new AppError(payload.error, 400);
  }
  return payload;
}

// Named actions used by the programs store.
export const sheetsClient = {
  health: () => request('health'),
  list: (params) => request('GET', params),
  get: (id) => request('get', { id }),
  categories: () => request('categories'),
  count: () => request('count').then((r) => r.total),
  countLive: () => request('countLive').then((r) => r.total),
  create: (data) => request('create', {}, { data }),
  update: (id, data) => request('update', { id }, { data }),
  remove: (id) => request('delete', { id }),
};

// Generic collection calls used by the auth/chat models.
export const sheetCollection = {
  find: (collection, query) => request('find', {}, { collection, query }).then((r) => r.rows),
  findOne: (collection, query) => request('findOne', {}, { collection, query }).then((r) => r.row),
  insertOne: (collection, doc) => request('insertOne', {}, { collection, doc }).then((r) => r.row),
  updateOne: (collection, query, update, single = true) =>
    request('updateOne', {}, { collection, query, update, single }).then((r) => r.matched),
  updateById: (collection, id, update) => request('updateById', {}, { collection, id, update }).then((r) => r.row),
  upsert: (collection, query, update) => request('upsert', {}, { collection, query, update }).then((r) => r.row),
  deleteOne: (collection, query) => request('deleteOne', {}, { collection, query }).then((r) => r.deleted),
  deleteById: (collection, id) => request('deleteById', {}, { collection, id }).then((r) => r.deleted),
  count: (collection, query) => request('countDocuments', {}, { collection, query }).then((r) => r.total),
  sum: (collection, field, query) => request('sum', {}, { collection, field, query }).then((r) => r.total),
  clear: (collection) => request('clear', {}, { collection }).then((r) => r.deleted),
};
