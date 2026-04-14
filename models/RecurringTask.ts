import mongoose, { Schema, Document, Model } from 'mongoose';

export type Frequency =
  | 'daily'
  | 'weekdays'
  | 'every_x_days'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export interface IRecurringTask extends Document {
  text: string;
  size: 'big' | 'small';
  tag: 'work' | 'learning' | 'personal' | 'health';
  frequency: Frequency;
  frequencyValue?: number;
  isActive: boolean;
  streak: number;
  bestStreak: number;
  lastGeneratedDate?: string;
  createdAt: Date;
}

const RecurringTaskSchema = new Schema<IRecurringTask>(
  {
    text: { type: String, required: true, trim: true },
    size: { type: String, enum: ['big', 'small'], required: true },
    tag: {
      type: String,
      enum: ['work', 'learning', 'personal', 'health'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekdays', 'every_x_days', 'weekly', 'biweekly', 'monthly'],
      required: true,
    },
    // every_x_days: the X | weekly: day of week 0-6 | monthly: day 1-31
    frequencyValue: { type: Number },
    isActive: { type: Boolean, default: true },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastGeneratedDate: { type: String },
  },
  { timestamps: true }
);

RecurringTaskSchema.index({ isActive: 1 });

const RecurringTask: Model<IRecurringTask> =
  mongoose.models.RecurringTask ??
  mongoose.model<IRecurringTask>('RecurringTask', RecurringTaskSchema);

export default RecurringTask;
