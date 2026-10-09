import { AppError } from '../utils/AppError.js';
import { query } from './db.js';
import { isUuid } from './sql.js';

// Programs store backed by Postgres. Mirrors mongoProgramsStore so the programs
// routes and the admin stats endpoint do not care which driver is active.

const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const SORTS = {
  newest: 'created_at desc',
  oldest: 'created_at asc',
  deadline: 'deadline asc nulls last, created_at desc',
};

const SUMMARY = [
  'title', 'organizer', 'type', 'category', 'venue', 'imageurls', 'tags', 'status', 'deadline', 'event_date', 'created_at',
];

function shape(row) {
  if (!row) return null;
  return {
    _id: row.id,
    title: row.title,
    organizer: row.organizer,
    type: row.type,
    category: row.category,
    venue: row.venue,
    about: row.about,
    registrationLink: row.registration_link,
    contact: row.contact,
    imageurls: row.imageurls ?? [],
    tags: row.tags ?? [],
    status: row.status,
    deadline: row.deadline ?? undefined,
    eventDate: row.event_date ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function shapeSummary(row) {
  const full = shape(row);
  const out = { _id: full._id };
  for (const key of ['title', 'organizer', 'type', 'category', 'venue', 'imageurls', 'tags', 'status', 'deadline', 'eventDate', 'createdAt']) {
    out[key] = full[key];
  }
  return out;
}

// Maps the API body onto columns. `createdBy` is only set on insert.
function toColumns(data) {
  const map = {
    title: 'title',
    organizer: 'organizer',
    type: 'type',
    category: 'category',
    venue: 'venue',
    about: 'about',
    registrationLink: 'registration_link',
    contact: 'contact',
    imageurls: 'imageurls',
    tags: 'tags',
    status: 'status',
    deadline: 'deadline',
    eventDate: 'event_date',
  };
  const out = {};
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) out[column] = data[key];
  }
  return out;
}

function insertSql(columns) {
  const keys = Object.keys(columns);
  if (!keys.length) return { text: 'insert into app_programs default values returning *', values: [] };
  return {
    text: `insert into app_programs (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    values: keys.map((k) => columns[k]),
  };
}

export const supabaseProgramsStore = {
  driver: 'supabase',

  async list({ q, category, status, sort = 'newest', page = 1, limit = 50, view = 'summary' }) {
    const conditions = [];
    const params = [];
    if (category && category !== 'All') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${escapeLike(q)}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(title ilike ${p} or organizer ilike ${p} or category ilike ${p} or type ilike ${p} or venue ilike ${p} or about ilike ${p} or array_to_string(tags, ' ') ilike ${p})`,
      );
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const order = SORTS[sort] || SORTS.newest;
    const offset = (page - 1) * limit;

    const columns = view === 'summary' ? SUMMARY.join(', ') : '*';
    const [rows, count] = await Promise.all([
      query(`select id, ${columns} from app_programs ${where} order by ${order} limit ${Number(limit)} offset ${Number(offset)}`, params),
      query(`select count(*)::int as total from app_programs ${where}`, params),
    ]);

    const total = count.rows[0]?.total ?? 0;
    const programs = rows.rows.map(view === 'summary' ? shapeSummary : shape);
    return { results: programs.length, total, page, pages: Math.max(1, Math.ceil(total / limit)), programs };
  },

  async categories() {
    const { rows } = await query(
      'select category as name, count(*)::int as count from app_programs group by category order by count desc, category asc',
    );
    return rows;
  },

  async findById(id) {
    if (!isUuid(id)) throw new AppError('Invalid id', 400);
    const { rows } = await query('select * from app_programs where id = $1', [id]);
    return rows[0] ? shape(rows[0]) : null;
  },

  async create(data, userId) {
    const columns = toColumns(data);
    if (userId && isUuid(userId)) columns.created_by = userId;
    const insert = insertSql(columns);
    const { rows } = await query(insert.text, insert.values);
    return shape(rows[0]);
  },

  async update(id, data) {
    if (!isUuid(id)) throw new AppError('Invalid id', 400);
    const columns = toColumns(data);
    const keys = Object.keys(columns);
    if (!keys.length) {
      const { rows } = await query('select * from app_programs where id = $1', [id]);
      return rows[0] ? shape(rows[0]) : null;
    }
    const assignments = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await query(
      `update app_programs set ${assignments} where id = $${keys.length + 1} returning *`,
      [...keys.map((k) => columns[k]), id],
    );
    return rows[0] ? shape(rows[0]) : null;
  },

  async remove(id) {
    if (!isUuid(id)) throw new AppError('Invalid id', 400);
    const { rowCount } = await query('delete from app_programs where id = $1', [id]);
    return rowCount > 0;
  },

  async count() {
    const { rows } = await query('select count(*)::int as total from app_programs');
    return rows[0]?.total ?? 0;
  },

  async countLive() {
    const { rows } = await query("select count(*)::int as total from app_programs where status = 'Live'");
    return rows[0]?.total ?? 0;
  },
};
