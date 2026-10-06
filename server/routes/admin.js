import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { email, name, objectId, password, username, validate } from '../middleware/validate.js';
import { Conversation, Message } from '../models/Chat.js';
import { User } from '../models/User.js';
import { getProgramsStore } from '../sheets/programsStore.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const router = Router();
router.use(protect, restrictTo('admin'));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const programs = getProgramsStore();
    const [users, admins, disabled, totalPrograms, livePrograms, openChats, unread] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ status: 'disabled' }),
      programs.count(),
      programs.countLive(),
      Conversation.countDocuments({ status: 'open' }),
      Conversation.aggregate([{ $group: { _id: null, total: { $sum: '$unreadForAdmin' } } }]),
    ]);
    res.json({
      status: 'success',
      data: { users, admins, disabled, programs: totalPrograms, livePrograms, openChats, unreadMessages: unread[0]?.total ?? 0 },
    });
  }),
);

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/users',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { q, role, status, page, limit } = req.validated.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({
      status: 'success',
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      data: { users: users.map((u) => u.toPublicJSON()) },
    });
  }),
);

const optionalEmail = z.preprocess((v) => (v === '' || v === null ? undefined : v), email.optional());

router.post(
  '/users',
  validate(
    z.object({
      name,
      username,
      email: optionalEmail,
      password,
      role: z.enum(['user', 'admin']).default('user'),
      status: z.enum(['active', 'disabled']).default('active'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await User.create({ ...req.body, emailVerified: false });
    res.status(201).json({ status: 'success', data: { user: user.toPublicJSON() } });
  }),
);

router.patch(
  '/users/:id',
  validate(z.object({ id: objectId }), 'params'),
  validate(
    z.object({
      name: name.optional(),
      username: username.optional(),
      email: z.union([email, z.literal(''), z.null()]).optional(),
      password: password.optional(),
      role: z.enum(['user', 'admin']).optional(),
      status: z.enum(['active', 'disabled']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    const isSelf = user._id.equals(req.user._id);
    if (isSelf && (req.body.role === 'user' || req.body.status === 'disabled')) {
      throw new AppError('You cannot demote or disable your own account', 400);
    }
    const { email: newEmail, password: newPassword, ...rest } = req.body;
    Object.assign(user, rest);
    if (newEmail !== undefined) {
      if (!newEmail) user.email = undefined;
      else if (newEmail !== user.email) {
        user.email = newEmail;
        user.emailVerified = false;
      }
    }
    if (newPassword) user.password = newPassword;
    await user.save();
    res.json({ status: 'success', data: { user: user.toPublicJSON() } });
  }),
);

router.delete(
  '/users/:id',
  validate(z.object({ id: objectId }), 'params'),
  asyncHandler(async (req, res) => {
    if (req.user._id.equals(req.params.id)) throw new AppError('You cannot delete your own account', 400);
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    const convo = await Conversation.findOneAndDelete({ user: user._id });
    if (convo) await Message.deleteMany({ conversation: convo._id });
    res.status(204).end();
  }),
);

export default router;
