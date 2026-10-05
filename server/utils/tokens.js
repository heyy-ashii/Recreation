import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const signToken = (userId) => jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export function sendAuth(res, user, status = 200) {
  const token = signToken(user._id);
  res.cookie(config.cookieName, token, cookieOptions());
  res.status(status).json({ status: 'success', data: { user: user.toPublicJSON() } });
}

export function clearAuth(res) {
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
}
