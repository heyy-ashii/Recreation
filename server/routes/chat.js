import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { chatLimiter, cronLimiter } from '../middleware/rateLimit.js';
import { objectId, validate } from '../middleware/validate.js';
import { Conversation, Message } from '../models/Chat.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const router = Router();

// Daily retention job. This one route is deliberately public (the chat routes
// below call `protect`): Vercel Cron cannot send a cookie, so it authenticates
// with the CRON_SECRET that Vercel sets as a bearer token.
router.get('/cron/cleanup', cronLimiter, asyncHandler(async (req, res) => {
  if (!config.cronSecret) throw new AppError('Cleanup is not configured', 503);
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${config.cronSecret}`) throw new AppError('Not authorised', 401);

  const cutoff = new Date(Date.now() - config.chat.retentionDays * 24 * 60 * 60 * 1000);
  const conversations = await Conversation.find({});
  let removed = 0;
  for (const conversation of conversations) {
    removed += await purgeOldMessages(conversation);
  }
  res.json({ status: 'success', data: { removed, cutoff, retentionDays: config.chat.retentionDays } });
}));

router.use(protect);

const messageBody = z.object({ body: z.string().trim().min(1, 'Message cannot be empty').max(2000) });
const sinceQuery = z.object({ since: z.coerce.date().optional() });

const shapeMessage = (m) => ({ _id: m._id, body: m.body, senderRole: m.senderRole, sender: m.sender, createdAt: m.createdAt });

// Old messages are dropped so the chat never grows without bound. Runs when a
// conversation is read, and again from the cleanup cron so idle chats also trim.
async function purgeOldMessages(conversation) {
  const cutoff = new Date(Date.now() - config.chat.retentionDays * 24 * 60 * 60 * 1000);
  const removed = await Message.deleteMany({ conversation: conversation._id, createdAt: { $lt: cutoff } });
  if (!removed) return 0;

  const latest = await Message.findOne({ conversation: conversation._id }).sort({ createdAt: -1 }).lean();
  conversation.lastMessage = latest ? String(latest.body).slice(0, 140) : '';
  if (latest) conversation.lastMessageAt = latest.createdAt;
  await conversation.save();
  return removed;
}

async function listMessages(conversationId, since) {
  const filter = { conversation: conversationId };
  if (since) filter.createdAt = { $gt: since };
  const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(200).lean();
  return messages.map(shapeMessage);
}

async function postMessage(conversation, sender, senderRole, body) {
  const message = await Message.create({ conversation: conversation._id, sender: sender._id, senderRole, body });
  conversation.lastMessage = body.slice(0, 140);
  conversation.lastMessageAt = message.createdAt;
  conversation.status = 'open';
  if (senderRole === 'admin') conversation.unreadForUser += 1;
  else conversation.unreadForAdmin += 1;
  await conversation.save();
  return shapeMessage(message);
}

// --- Current user's conversation with the admin team ---
router.get(
  '/me',
  validate(sinceQuery, 'query'),
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOne({ user: req.user._id });
    if (!conversation) return res.json({ status: 'success', data: { conversation: null, messages: [] } });
    await purgeOldMessages(conversation);
    const messages = await listMessages(conversation._id, req.validated.query.since);
    if (conversation.unreadForUser) {
      conversation.unreadForUser = 0;
      await conversation.save();
    }
    res.json({ status: 'success', data: { conversation, messages } });
  }),
);

router.get(
  '/me/unread',
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOne({ user: req.user._id }).select('unreadForUser').lean();
    res.json({ status: 'success', data: { unread: conversation?.unreadForUser ?? 0 } });
  }),
);

router.post(
  '/me/messages',
  chatLimiter,
  validate(messageBody),
  asyncHandler(async (req, res) => {
    const conversation =
      (await Conversation.findOne({ user: req.user._id })) || (await Conversation.create({ user: req.user._id }));
    const message = await postMessage(conversation, req.user, 'user', req.body.body);
    res.status(201).json({ status: 'success', data: { message } });
  }),
);

// --- Admin inbox ---
const admin = Router();
admin.use(restrictTo('admin'));

admin.get(
  '/',
  validate(z.object({ status: z.enum(['open', 'closed']).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const filter = req.validated.query.status ? { status: req.validated.query.status } : {};
    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(200)
      .populate('user', 'name username email')
      .lean();
    res.json({ status: 'success', data: { conversations } });
  }),
);

admin.get(
  '/:id/messages',
  validate(z.object({ id: objectId }), 'params'),
  validate(sinceQuery, 'query'),
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findById(req.params.id).populate('user', 'name username email');
    if (!conversation) throw new AppError('Conversation not found', 404);
    await purgeOldMessages(conversation);
    const messages = await listMessages(conversation._id, req.validated.query.since);
    if (conversation.unreadForAdmin) {
      conversation.unreadForAdmin = 0;
      await conversation.save();
    }
    res.json({ status: 'success', data: { conversation, messages } });
  }),
);

admin.post(
  '/:id/messages',
  validate(z.object({ id: objectId }), 'params'),
  validate(messageBody),
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new AppError('Conversation not found', 404);
    const message = await postMessage(conversation, req.user, 'admin', req.body.body);
    res.status(201).json({ status: 'success', data: { message } });
  }),
);

admin.patch(
  '/:id',
  validate(z.object({ id: objectId }), 'params'),
  validate(z.object({ status: z.enum(['open', 'closed']) })),
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findByIdAndUpdate(req.params.id, { status: req.body.status }, { returnDocument: 'after' });
    if (!conversation) throw new AppError('Conversation not found', 404);
    res.json({ status: 'success', data: { conversation } });
  }),
);

router.use('/conversations', admin);

export default router;
