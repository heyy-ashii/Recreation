import mongoose from 'mongoose';
import { sheetsConfigured } from '../config.js';
import { SheetsOtp } from '../sheets/models.js';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ['signup', 'reset'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const MongoOtp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

export const Otp = sheetsConfigured() ? SheetsOtp : MongoOtp;
