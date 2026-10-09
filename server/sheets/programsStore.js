import { datastore } from '../config.js';
import { Program } from '../models/Program.js';
import { supabaseProgramsStore } from '../supabase/programsStore.js';
import { AppError } from '../utils/AppError.js';
import { sheetsClient } from './client.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUMMARY_FIELDS = 'title organizer type category venue imageurls tags status deadline eventDate createdAt';
const sorts = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, deadline: { deadline: 1, createdAt: -1 } };
const OBJECT_ID = /^[a-f\d]{24}$/i;

// Mongo rejects a non-ObjectId with a CastError; surface it as the 400 the API has always returned.
function ensureObjectId(id) {
  if (!OBJECT_ID.test(String(id))) throw new AppError('Invalid id', 400);
}

// Programs live in MongoDB by default and in the Google Sheet when SHEETS_API_URL is set.
export const mongoProgramsStore = {
  driver: 'mongo',

  async list({ q, category, status, sort = 'newest', page = 1, limit = 50, view = 'summary' }) {
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: rx }, { organizer: rx }, { category: rx }, { type: rx }, { venue: rx }, { tags: rx }, { about: rx }];
    }
    const query = Program.find(filter)
      .sort(sorts[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    if (view === 'summary') query.select(SUMMARY_FIELDS);
    const [programs, total] = await Promise.all([query, Program.countDocuments(filter)]);
    return { results: programs.length, total, page, pages: Math.ceil(total / limit), programs };
  },

  async categories() {
    const rows = await Program.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]);
    return rows.filter((r) => r._id).map((r) => ({ name: r._id, count: r.count }));
  },

  async findById(id) {
    ensureObjectId(id);
    return Program.findById(id).lean();
  },

  async create(data, userId) {
    const program = await Program.create({ ...data, createdBy: userId });
    return program.toObject();
  },

  async update(id, data) {
    ensureObjectId(id);
    return Program.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }).lean();
  },

  async remove(id) {
    ensureObjectId(id);
    return Boolean(await Program.findByIdAndDelete(id));
  },

  count() {
    return Program.countDocuments();
  },

  countLive() {
    return Program.countDocuments({ status: 'Live' });
  },
};

// The Apps Script returns an `id` column; the frontend expects `_id` and optional dates.
function shapeProgram(row) {
  if (!row) return null;
  const { id, ...rest } = row;
  return {
    ...rest,
    _id: row._id || id,
    deadline: rest.deadline || undefined,
    eventDate: rest.eventDate || undefined,
  };
}

export const sheetsProgramsStore = {
  driver: 'sheets',

  async list(params) {
    const payload = await sheetsClient.list(params);
    return { ...payload, programs: (payload.programs || []).map(shapeProgram) };
  },

  async categories() {
    const payload = await sheetsClient.categories();
    return payload.categories || [];
  },

  async findById(id) {
    const payload = await sheetsClient.get(id);
    return shapeProgram(payload.program);
  },

  async create(data) {
    const payload = await sheetsClient.create(data);
    return shapeProgram(payload.program);
  },

  async update(id, data) {
    const payload = await sheetsClient.update(id, data);
    return shapeProgram(payload.program);
  },

  async remove(id) {
    const payload = await sheetsClient.remove(id);
    return Boolean(payload.deleted);
  },

  count() {
    return sheetsClient.count();
  },

  countLive() {
    return sheetsClient.countLive();
  },
};

export function getProgramsStore() {
  const active = datastore();
  if (active === 'supabase') return supabaseProgramsStore;
  return active === 'sheets' ? sheetsProgramsStore : mongoProgramsStore;
}

