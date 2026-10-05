import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { objectId, validate } from '../middleware/validate.js';
import { Program, PROGRAM_STATUSES } from '../models/Program.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUMMARY_FIELDS = 'title organizer type category venue imageurls tags status deadline eventDate createdAt';

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(PROGRAM_STATUSES).optional(),
  sort: z.enum(['newest', 'oldest', 'deadline']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  view: z.enum(['summary', 'full']).default('summary'),
});

const sorts = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, deadline: { deadline: 1, createdAt: -1 } };

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { q, category, status, sort, page, limit, view } = req.validated.query;
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
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json({ status: 'success', results: programs.length, total, page, pages: Math.ceil(total / limit), data: { programs } });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await Program.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]);
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({ status: 'success', data: { categories: rows.filter((r) => r._id).map((r) => ({ name: r._id, count: r.count })) } });
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: objectId }), 'params'),
  asyncHandler(async (req, res) => {
    const program = await Program.findById(req.params.id).lean();
    if (!program) throw new AppError('Program not found', 404);
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json({ status: 'success', data: { program } });
  }),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.date({ error: 'Invalid date' }).optional(),
);
const url = z.string().trim().url('Must be a valid URL').max(500);

const programBody = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.string().trim().min(1, 'Category is required').max(60),
  organizer: z.string().trim().max(300).default(''),
  type: z.string().trim().max(120).default(''),
  venue: z.string().trim().max(300).default(''),
  about: z.string().max(20000).default(''),
  registrationLink: z.union([url, z.literal('')]).default(''),
  contact: z.string().trim().max(300).default(''),
  imageurls: z.array(url).max(10).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: z.enum(PROGRAM_STATUSES).default('Live'),
  deadline: optionalDate,
  eventDate: optionalDate,
});

router.post(
  '/',
  protect,
  restrictTo('admin'),
  validate(programBody),
  asyncHandler(async (req, res) => {
    const program = await Program.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ status: 'success', data: { program } });
  }),
);

router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(z.object({ id: objectId }), 'params'),
  validate(programBody.partial()),
  asyncHandler(async (req, res) => {
    const program = await Program.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!program) throw new AppError('Program not found', 404);
    res.json({ status: 'success', data: { program } });
  }),
);

router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(z.object({ id: objectId }), 'params'),
  asyncHandler(async (req, res) => {
    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) throw new AppError('Program not found', 404);
    res.status(204).end();
  }),
);

export default router;
