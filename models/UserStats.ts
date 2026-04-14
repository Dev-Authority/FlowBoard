import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserStats extends Document {
  currentStreak: number;
  longestStreak: number;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  totalTasksPostponed: number;
  totalTasksAbandoned: number;
  lastActiveDate: string;
}

const UserStatsSchema = new Schema<IUserStats>(
  {
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalTasksCreated: { type: Number, default: 0 },
    totalTasksCompleted: { type: Number, default: 0 },
    totalTasksPostponed: { type: Number, default: 0 },
    totalTasksAbandoned: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: '' },
  },
  { timestamps: true }
);

const UserStats: Model<IUserStats> =
  mongoose.models.UserStats ??
  mongoose.model<IUserStats>('UserStats', UserStatsSchema);

export default UserStats;
