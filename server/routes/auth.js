import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { protect } from '../middleware/auth.js';
import { loginLimiter, otpLimiter } from '../middleware/rateLimit.js';
import { email, name, password, username, validate } from '../middleware/validate.js';
import { Otp } from '../models/Otp.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { sendOtpEmail } from '../utils/email.js';
import { clearAuth, sendAuth } from '../utils/tokens.js';

const router = Router();

async function issueOtp(emailAddress, purpose) {
  const existing = await Otp.findOne({ email: emailAddress, purpose });
  if (existing) {
    const elapsed = (Date.now() - existing.updatedAt.getTime()) / 1000;
    if (elapsed < config.otp.resendCooldownSeconds) {
      const wait = Math.ceil(config.otp.resendCooldownSeconds - elapsed);
      throw new AppError(`Please wait ${wait}s before requesting another code`, 429);
    }
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const { delivered } = await sendOtpEmail(emailAddress, code, purpose);
  // In production a code we cannot deliver is useless, so fail loudly instead of
  // replying "we sent a code". Outside production the code is returned so local
  // development and tests can finish the flow.
  if (!delivered && config.isProd) {
    throw new AppError(
      'Email delivery is not configured, so the verification code could not be sent. Please contact the site administrator.',
      503,
    );
  }
  await Otp.findOneAndUpdate(
    { email: emailAddress, purpose },
    { codeHash, attempts: 0, expiresAt: new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000) },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, timestamps: true },
  );
  return !delivered ? code : undefined;
}

async function consumeOtp(emailAddress, purpose, code) {
  const otp = await Otp.findOne({ email: emailAddress, purpose });
  if (!otp || otp.expiresAt < new Date()) throw new AppError('Code expired. Request a new one.', 400);
  if (otp.attempts >= config.otp.maxAttempts) {
    await otp.deleteOne();
    throw new AppError('Too many wrong attempts. Request a new code.', 429);
  }
  const ok = await bcrypt.compare(code, otp.codeHash);
  if (!ok) {
    otp.attempts += 1;
    await otp.save();
    throw new AppError('Incorrect verification code', 400);
  }
  await otp.deleteOne();
}

const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

router.post(
  '/signup/request-otp',
  otpLimiter,
  validate(z.object({ email })),
  asyncHandler(async (req, res) => {
    if (await User.exists({ email: req.body.email })) {
      throw new AppError('An account with this email already exists. Please log in.', 409);
    }
    const devCode = await issueOtp(req.body.email, 'signup');
    res.json({
      status: 'success',
      message: `We sent a 6-digit code to ${req.body.email}`,
      ...(devCode ? { devCode } : {}),
    });
  }),
);

router.post(
  '/signup/verify',
  loginLimiter,
  validate(z.object({ email, code: otpCode, name, username, password })),
  asyncHandler(async (req, res) => {
    const { email: emailAddress, code, ...rest } = req.body;
    if (await User.exists({ email: emailAddress })) throw new AppError('An account with this email already exists', 409);
    if (await User.exists({ username: rest.username })) throw new AppError('That username is already taken', 409);
    await consumeOtp(emailAddress, 'signup', code);
    const user = await User.create({ ...rest, email: emailAddress, emailVerified: true, role: 'user', lastLoginAt: new Date() });
    sendAuth(res, user, 201);
  }),
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const identifier = String(req.body?.identifier ?? req.body?.username ?? req.body?.email ?? '')
      .trim()
      .toLowerCase();
    const pwd = String(req.body?.password ?? '');
    if (!identifier || !pwd) throw new AppError('Please provide username/email and password', 400);

    const query = identifier.includes('@') ? { email: identifier } : { username: identifier };
    const user = await User.findOne(query).select('+password +failedLoginAttempts +lockUntil');
    if (user?.lockUntil && user.lockUntil > new Date()) {
      throw new AppError('Account temporarily locked after too many failed attempts. Try again later.', 423);
    }
    if (!user || !(await user.checkPassword(pwd))) {
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= config.login.maxFailedAttempts) {
          user.lockUntil = new Date(Date.now() + config.login.lockMinutes * 60 * 1000);
          user.failedLoginAttempts = 0;
        }
        await user.save({ validateModifiedOnly: true });
      }
      throw new AppError('Incorrect username or password', 401);
    }
    if (user.status !== 'active') throw new AppError('This account has been disabled. Contact the admin.', 403);
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save({ validateModifiedOnly: true });
    sendAuth(res, user);
  }),
);

router.post('/logout', (_req, res) => {
  clearAuth(res);
  res.json({ status: 'success' });
});

router.post(
  '/password/request-otp',
  otpLimiter,
  validate(z.object({ email })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    let devCode;
    if (user && user.status === 'active') devCode = await issueOtp(req.body.email, 'reset');
    res.json({
      status: 'success',
      message: 'If an account exists for that email, a reset code has been sent.',
      ...(devCode ? { devCode } : {}),
    });
  }),
);

router.post(
  '/password/reset',
  loginLimiter,
  validate(z.object({ email, code: otpCode, password })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || user.status !== 'active') throw new AppError('Code expired. Request a new one.', 400);
    await consumeOtp(req.body.email, 'reset', req.body.code);
    user.password = req.body.password;
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    sendAuth(res, user);
  }),
);

router.get('/me', protect, (req, res) => {
  res.json({ status: 'success', data: { user: req.user.toPublicJSON() } });
});

router.patch(
  '/update-me',
  protect,
  validate(z.object({ name: name.optional(), username: username.optional() })),
  asyncHandler(async (req, res) => {
    Object.assign(req.user, req.body);
    await req.user.save({ validateModifiedOnly: true });
    res.json({ status: 'success', data: { user: req.user.toPublicJSON() } });
  }),
);

router.patch(
  '/update-password',
  protect,
  validate(z.object({ currentPassword: z.string().min(1), password })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.checkPassword(req.body.currentPassword))) throw new AppError('Current password is incorrect', 401);
    user.password = req.body.password;
    await user.save();
    sendAuth(res, user);
  }),
);

export default router;
