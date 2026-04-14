import mongoose, { Schema, Document, Model } from 'mongoose';

export interface TagLimits {
  work: number;
  learning: number;
  personal: number;
  health: number;
}

export interface IUserPreferences extends Document {
  theme: 'dark' | 'light';
  eveningReminderTime: string;
  morningReminderTime: string;
  tagLimits: TagLimits;
}

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    theme:                { type: String, enum: ['dark', 'light'], default: 'dark' },
    eveningReminderTime:  { type: String, default: '21:00' },
    morningReminderTime:  { type: String, default: '08:00' },
    tagLimits: {
      work:     { type: Number, default: 0, min: 0 },
      learning: { type: Number, default: 0, min: 0 },
      personal: { type: Number, default: 0, min: 0 },
      health:   { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

const UserPreferences: Model<IUserPreferences> =
  mongoose.models.UserPreferences ??
  mongoose.model<IUserPreferences>('UserPreferences', UserPreferencesSchema);

export default UserPreferences;
