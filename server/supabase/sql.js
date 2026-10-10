import { AppError } from '../utils/AppError.js';

// Translates the Mongo-style filters the routes use into parameterised SQL.
// Only the operators this app actually sends are supported; anything else is a
// programming error, not a user error, so it throws loudly rather than silently
// matching the wrong rows.

export class Where {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  eq(column, value) {
    return this.add(`${column} = ?`, value);
  }

  add(sql, value) {
    if (value === undefined) {
      this.clauses.push(sql);
    } else {
      this.params.push(value);
      this.clauses.push(sql.replace('?', `$${this.params.length}`));
    }
    return this;
  }

  toString() {
    return this.clauses.length ? this.clauses.join(' and ') : 'true';
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp);
}

function buildOne(where, column, cond) {
  if (cond === undefined) {
    where.add(`${column} is null`);
    return;
  }
  if (cond === null) {
    where.add(`${column} is null`);
    return;
  }
  if (cond instanceof RegExp) {
    where.add(`${column} ~ ?`, cond.source);
    return;
  }
  if (isPlainObject(cond)) {
    for (const [op, target] of Object.entries(cond)) {
      switch (op) {
        case '$in':
          where.add(`${column} = any(?)`, target);
          break;
        case '$nin':
          where.add(`not (${column} = any(?))`, target);
          break;
        case '$ne':
          where.add(`${column} is distinct from ?`, target);
          break;
        case '$gt':
          where.add(`${column} > ?`, target);
          break;
        case '$gte':
          where.add(`${column} >= ?`, target);
          break;
        case '$lt':
          where.add(`${column} < ?`, target);
          break;
        case '$lte':
          where.add(`${column} <= ?`, target);
          break;
        case '$regex':
          where.add(`${column} ~ ?`, target instanceof RegExp ? target.source : String(target));
          break;
        case '$exists':
          where.add(target ? `${column} is not null` : `${column} is null`);
          break;
        default:
          throw new AppError(`Unsupported query operator: ${op}`, 500);
      }
    }
    return;
  }
  where.add(`${column} = ?`, cond);
}

export function buildWhere(query = {}, map = {}) {
  const where = new Where();
  for (const [key, cond] of Object.entries(query)) {
    if (key === '$or') {
      const parts = cond.map((sub) => buildWhere(sub, map));
      if (!parts.length) continue;
      let offset = where.params.length;
      const sql = parts
        .map((p) => {
          const shifted = p.toString().replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
          offset += p.params.length;
          return `(${shifted})`;
        })
        .join(' or ');
      where.clauses.push(`(${sql})`);
      where.params.push(...parts.flatMap((p) => p.params));
      continue;
    }
    if (key === '$and') {
      for (const sub of cond) {
        const part = buildWhere(sub, map);
        where.clauses.push(`(${part.toString()})`);
        where.params.push(...part.params);
      }
      continue;
    }
    if (key === '$expr' || key === '$where' || key === '$jsonSchema') {
      throw new AppError(`Unsupported query operator: ${key}`, 500);
    }
    const column = key === '_id' ? 'id' : map[key];
    if (!column) throw new AppError(`Unsupported query field: ${key}`, 500);
    buildOne(where, column, cond);
  }
  return where;
}

const SORT_DIRECTIONS = { 1: 'asc', '-1': 'desc', asc: 'asc', desc: 'desc' };

export function buildOrderBy(sort, map = {}) {
  if (!sort) return '';
  const parts = [];
  for (const [field, dir] of Object.entries(sort)) {
    const column = map[field];
    if (!column) throw new AppError(`Unsupported sort field: ${field}`, 500);
    const direction = SORT_DIRECTIONS[String(dir)];
    if (!direction) throw new AppError(`Unsupported sort direction: ${dir}`, 500);
    parts.push(`${column} ${direction}`);
  }
  return parts.length ? `order by ${parts.join(', ')}` : '';
}

export function buildLimitOffset({ skip = 0, limit = 0 }) {
  const parts = [];
  if (limit) parts.push(`limit ${Number(limit)}`);
  if (skip) parts.push(`offset ${Number(skip)}`);
  return parts.join(' ');
}

// Validates a UUID before it reaches Postgres, which would otherwise raise a
// 22P02 syntax error instead of a clean 404.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID.test(String(v));
