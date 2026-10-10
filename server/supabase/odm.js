import bcrypt from 'bcryptjs';
import { SheetsQuery } from '../sheets/odm.js';
import { AppError } from '../utils/AppError.js';
import { query } from './db.js';
import { Where, buildLimitOffset, buildOrderBy, buildWhere, isUuid } from './sql.js';

// A Mongo-like ODM over Postgres. It exposes the same surface the routes use
// (find/findOne/create/save/populate/aggregate) so the models can swap drivers
// without touching the routes. Queries are compiled to SQL in `sql.js`.

const UUID_COLUMNS = new Set(['id', 'user_id', 'user_a', 'user_b', 'sender_id', 'conversation_id', 'created_by']);

function castValue(column, value) {
  if (value === undefined || value === null) return value;
  if (UUID_COLUMNS.has(column)) return isUuid(value) ? String(value) : value;
  return value;
}

function fromRow(spec, row) {
  if (!row) return null;
  const out = { _id: row.id };
  for (const [camel, column] of Object.entries(spec.columns)) {
    out[camel] = row[column];
  }
  for (const [field, fallback] of Object.entries(spec.defaults || {})) {
    if (out[field] === undefined || out[field] === null || out[field] === '') {
      out[field] = typeof fallback === 'function' ? fallback() : fallback;
    }
  }
  for (const field of spec.dates || []) {
    if (out[field]) out[field] = new Date(out[field]);
  }
  for (const field of spec.numbers || []) {
    if (out[field] !== undefined && out[field] !== null) out[field] = Number(out[field]);
  }
  for (const field of spec.booleans || []) {
    out[field] = out[field] === true || String(out[field]).toLowerCase() === 'true';
  }
  return out;
}

function toColumns(spec, doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id' || key === 'id' || key === '__v') continue;
    const column = spec.columns[key];
    if (!column) continue;
    if (value === undefined) continue;
    out[column] = castValue(column, value);
  }
  return out;
}

function insertSql(table, columns) {
  const keys = Object.keys(columns);
  if (!keys.length) return { text: `insert into ${table} default values returning *`, values: [] };
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  return {
    text: `insert into ${table} (${keys.join(', ')}) values (${placeholders.join(', ')}) returning *`,
    values: keys.map((k) => columns[k]),
  };
}

export function createCollection(spec) {
  const { table } = spec;
  const map = spec.columns;

  async function selectWhere(where, { order = '', limit = '', single = false } = {}) {
    const text = `select * from ${table} where ${where.toString()} ${order} ${limit}`.trim();
    const { rows } = await query(text, where.params);
    return single ? rows[0] ?? null : rows;
  }

  const all = async () => (await query(`select * from ${table}`)).rows.map((r) => fromRow(spec, r));

  const makeDoc = (row) => {
    const data = fromRow(spec, row);
    const state = { data, dirty: {} };

    async function save() {
      const patch = { ...state.dirty };
      if (spec.hashesPassword && patch.password !== undefined) {
        patch.password = await bcrypt.hash(String(patch.password), 12);
        patch.passwordChangedAt = new Date(Date.now() - 1000);
      }
      const columns = toColumns(spec, patch);
      if (!Object.keys(columns).length) return self;
      const keys = Object.keys(columns);
      const assignments = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const { rows } = await query(
        `update ${table} set ${assignments} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => columns[k]), self._id],
      );
      if (rows[0]) state.data = fromRow(spec, rows[0]);
      state.dirty = {};
      return self;
    }

    async function populate(field, selection) {
      const ref = spec.populates?.[field];
      const value = state.data[field];
      if (!ref || !value) return self;
      const row = await ref.findById(typeof value === 'object' ? value._id : value).lean();
      if (row) {
        const fields = selection ? String(selection).split(/\s+/).filter((f) => !f.startsWith('+')) : null;
        const plain = { _id: row._id };
        for (const [k, v] of Object.entries(row)) {
          if (fields && !fields.includes(k)) continue;
          plain[k] = v;
        }
        state.data[field] = plain;
      }
      return self;
    }

    const self = {
      _id: data._id,
      save,
      populate,
      toPublicJSON: () => spec.publicJSON(state.data),
      checkPassword: (candidate) => bcrypt.compare(candidate, state.data.password ?? ''),
      changedPasswordAfter: (iat) => {
        const changed = state.data.passwordChangedAt;
        if (!changed) return false;
        return Math.floor(new Date(changed).getTime() / 1000) > iat;
      },
      equals: (other) => String(self._id) === String(other?._id ?? other),
      deleteOne: async () => {
        await query(`delete from ${table} where id = $1`, [self._id]);
      },
      lean: () => ({ ...state.data, _id: state.data._id }),
      toObject: () => ({ ...state.data, _id: state.data._id }),
      _state: state,
    };

    return new Proxy(self, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return state.data[prop];
      },
      set(target, prop, value) {
        if (prop in target && typeof target[prop] === 'function') {
          target[prop] = value;
          return true;
        }
        state.data[prop] = value;
        state.dirty[prop] = value;
        return true;
      },
      has: (target, prop) => prop in target || prop in state.data,
      ownKeys: (target) => [...new Set([...Object.keys(target), ...Object.keys(state.data)])],
      getOwnPropertyDescriptor(target, prop) {
        if (prop in target) return { configurable: true, enumerable: true, value: target[prop], writable: true };
        if (prop in state.data) return { configurable: true, enumerable: true, value: state.data[prop], writable: true };
        return undefined;
      },
    });
  };

  async function upsertOne(query_, update) {
    const where = buildWhere(query_, map);
    const existing = await selectWhere(where, { single: true });
    if (existing) {
      const columns = toColumns(spec, update);
      const keys = Object.keys(columns);
      if (!keys.length) return makeDoc(existing);
      const assignments = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const { rows } = await query(
        `update ${table} set ${assignments} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => columns[k]), existing.id],
      );
      return makeDoc(rows[0]);
    }
    const merged = toColumns(spec, { ...query_, ...update });
    const keys = Object.keys(merged);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const conflict = spec.upsertOn?.length
      ? `on conflict (${spec.upsertOn.join(', ')}) do update set updated_at = now()`
      : '';
    const { rows } = await query(
      `insert into ${table} (${keys.join(', ')}) values (${placeholders.join(', ')}) ${conflict} returning *`,
      keys.map((k) => merged[k]),
    );
    return makeDoc(rows[0]);
  }

  return {
    name: spec.name,
    table,
    all,
    fromRow: (row) => fromRow(spec, row),
    makeDoc,
    create: async (doc) => {
      const columns = toColumns(spec, { ...doc });
      if (spec.hashesPassword && columns.password) columns.password = await bcrypt.hash(String(columns.password), 12);
      const insert = insertSql(table, columns);
      const { rows } = await query(insert.text, insert.values);
      return makeDoc(rows[0]);
    },
    insertMany: async (docs) => {
      const out = [];
      for (const doc of docs) out.push(await this.create(doc));
      return out;
    },
      find: (filter = {}) => {
        const q = new SheetsQuery(async () => {
          const where = buildWhere(filter, map);
          const order = buildOrderBy(q._opts.sort, map);
          const limit = buildLimitOffset({ skip: q._opts.skip, limit: q._opts.limit });
          return (await selectWhere(where, { order, limit })).map(makeDoc);
        });
        q._preApplied = true;
        return q;
      },
    findOne: (filter = {}) =>
      new SheetsQuery(async () => {
        const row = await selectWhere(buildWhere(filter, map), { single: true });
        return row ? [makeDoc(row)] : [];
      }, true),
    findById: (id) =>
      new SheetsQuery(async () => {
        if (!isUuid(id)) return [];
        const row = await selectWhere(new Where().eq('id', id), { single: true });
        return row ? [makeDoc(row)] : [];
      }, true),
    findByIdAndUpdate: async (id, update, opts = {}) => {
      if (!isUuid(id)) return null;
      const columns = toColumns(spec, update);
      if (spec.hashesPassword && columns.password) columns.password = await bcrypt.hash(String(columns.password), 12);
      const keys = Object.keys(columns);
      if (!keys.length) return makeDoc(await selectWhere(new Where().eq('id', id), { single: true }));
      const assignments = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const { rows } = await query(
        `update ${table} set ${assignments} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => columns[k]), id],
      );
      if (rows[0]) return makeDoc(rows[0]);
      if (!opts.upsert) return null;
      const insert = insertSql(table, { id, ...columns });
      return makeDoc((await query(insert.text, insert.values)).rows[0]);
    },
    findByIdAndDelete: async (id) => {
      if (!isUuid(id)) return null;
      const { rows } = await query(`delete from ${table} where id = $1 returning *`, [id]);
      return rows[0] ? makeDoc(rows[0]) : null;
    },
    findOneAndDelete: async (filter = {}) => {
      const where = buildWhere(filter, map);
      const { rows } = await query(`delete from ${table} where id in (select id from ${table} where ${where.toString()} limit 1) returning *`, where.params);
      return rows[0] ? makeDoc(rows[0]) : null;
    },
    findOneAndUpdate: async (filter = {}, update = {}, opts = {}) => {
      const where = buildWhere(filter, map);
      const row = await selectWhere(where, { single: true });
      if (!row) return opts.upsert ? upsertOne(filter, update) : null;
      return this.findByIdAndUpdate(row.id, update);
    },
    countDocuments: async (filter = {}) => {
      const where = buildWhere(filter, map);
      const { rows } = await query(`select count(*)::int as total from ${table} where ${where.toString()}`, where.params);
      return rows[0]?.total ?? 0;
    },
    exists: async (filter = {}) => {
      const where = buildWhere(filter, map);
      const { rows } = await query(`select 1 from ${table} where ${where.toString()} limit 1`, where.params);
      return rows.length > 0;
    },
    updateMany: async (filter = {}, update = {}) => {
      const where = buildWhere(filter, map);
      const columns = toColumns(spec, update.$set || update);
      const keys = Object.keys(columns);
      if (!keys.length) return 0;
      const offset = where.params.length;
      const assignments = keys.map((k, i) => `${k} = $${offset + i + 1}`).join(', ');
      const { rowCount } = await query(
        `update ${table} set ${assignments} where ${where.toString()}`,
        [...where.params, ...keys.map((k) => columns[k])],
      );
      return rowCount ?? 0;
    },
    deleteMany: async (filter = {}) => {
      const where = buildWhere(filter, map);
      const { rowCount } = await query(`delete from ${table} where ${where.toString()}`, where.params);
      return rowCount ?? 0;
    },
    aggregate: async (pipeline) => {
      const group = pipeline.find((s) => s.$group);
      if (!group) return [];
      const where = buildWhere(group.$match || {}, map);
      const selects = [];
      for (const [out, expr] of Object.entries(group)) {
        if (out === '_id') continue;
        if (expr.$sum) {
          const field = typeof expr.$sum === 'string' ? map[expr.$sum.replace('$', '')] : null;
          if (!field) throw new AppError(`Unsupported $sum in aggregate: ${expr.$sum}`, 500);
          selects.push(`coalesce(sum(${field}), 0)::int as ${out}`);
        }
      }
      if (!selects.length) return [];
      const { rows } = await query(`select ${selects.join(', ')} from ${table} where ${where.toString()}`, where.params);
      return [{ _id: null, ...(rows[0] || {}) }];
    },
  };
}
