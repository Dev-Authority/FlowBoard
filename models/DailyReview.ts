import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDailyReview extends Document {
  date: string; // YYYY-MM-DD
  whatGotDone: string;
  whatStoppedMe: string;
  createdAt: Date;
}

const DailyReviewSchema = new Schema<IDailyReview>(
  {
    date: { type: String, required: true },
    whatGotDone: { type: String, required: true },
    whatStoppedMe: { type: String, required: true },
  },
  { timestamps: true }
);

const DailyReview: Model<IDailyReview> =
  mongoose.models.DailyReview ??
  mongoose.model<IDailyReview>('DailyReview', DailyReviewSchema);

export default DailyReview;
