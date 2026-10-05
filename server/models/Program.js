import mongoose from 'mongoose';

export const PROGRAM_STATUSES = ['Live', 'Recent', 'Closed'];

const programSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    organizer: { type: String, trim: true, maxlength: 300, default: '' },
    type: { type: String, trim: true, maxlength: 120, default: '' },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    venue: { type: String, trim: true, maxlength: 300, default: '' },
    about: { type: String, maxlength: 20000, default: '' },
    registrationLink: { type: String, trim: true, maxlength: 500, default: '' },
    contact: { type: String, trim: true, maxlength: 300, default: '' },
    imageurls: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    status: { type: String, enum: PROGRAM_STATUSES, default: 'Live' },
    deadline: Date,
    eventDate: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

programSchema.index({ createdAt: -1 });
programSchema.index({ category: 1, status: 1 });

export const Program = mongoose.models.Program || mongoose.model('Program', programSchema);
