import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { programId, validate } from '../middleware/validate.js';
import { PROGRAM_STATUSES } from '../models/Program.js';
import { getProgramsStore } from '../sheets/programsStore.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const router = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(PROGRAM_STATUSES).optional(),
  sort: z.enum(['newest', 'oldest', 'deadline']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  view: z.enum(['summary', 'full']).default('summary'),
});

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const payload = await getProgramsStore().list(req.validated.query);
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json({ status: 'success', ...payload, data: { programs: payload.programs } });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await getProgramsStore().categories();
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({ status: 'success', data: { categories } });
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: programId }), 'params'),
  asyncHandler(async (req, res) => {
    const program = await getProgramsStore().findById(req.params.id);
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
    const program = await getProgramsStore().create(req.body, req.user._id);
    res.status(201).json({ status: 'success', data: { program } });
  }),
);

router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(z.object({ id: programId }), 'params'),
  validate(programBody.partial()),
  asyncHandler(async (req, res) => {
    const program = await getProgramsStore().update(req.params.id, req.body);
    if (!program) throw new AppError('Program not found', 404);
    res.json({ status: 'success', data: { program } });
  }),
);

router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(z.object({ id: programId }), 'params'),
  asyncHandler(async (req, res) => {
    const removed = await getProgramsStore().remove(req.params.id);
    if (!removed) throw new AppError('Program not found', 404);
    res.status(204).end();
  }),
);

export default router;
