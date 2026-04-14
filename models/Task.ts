import mongoose, { Schema, Document, Model } from 'mongoose';

export interface TimerSession {
  start: Date;
  end?: Date;
}

export interface ITask extends Document {
  text: string;
  size: 'big' | 'small';
  status: 'todo' | 'doing' | 'done' | 'postponed';
  tag: 'work' | 'learning' | 'personal' | 'health';
  date: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  postponeCount: number;
  postponeReasons: string[];
  postponedAt: Date[];          // timestamp of each postponement
  timerSessions: TimerSession[]; // for accurate time tracking
  notes?: string;               // optional task context
  subtasks: { _id: mongoose.Types.ObjectId; text: string; done: boolean }[];
  isRecurring: boolean;
  recurringId?: mongoose.Types.ObjectId;
  isAbandoned?: boolean;
  sortOrder?: number;
  createdAt: Date;
}

const TimerSessionSchema = new Schema<TimerSession>(
  { start: { type: Date, required: true }, end: { type: Date } },
  { _id: false }
);

const SubtaskSchema = new Schema(
  { text: { type: String, required: true, maxlength: 500 }, done: { type: Boolean, default: false } },
  { _id: true }
);

const TaskSchema = new Schema<ITask>(
  {
    text:             { type: String, required: true, trim: true },
    size:             { type: String, enum: ['big', 'small'], required: true },
    status:           { type: String, enum: ['todo', 'doing', 'done', 'postponed'], default: 'todo' },
    tag:              { type: String, enum: ['work', 'learning', 'personal', 'health'], required: true },
    date:             { type: String, required: true },
    estimatedMinutes: { type: Number },
    actualMinutes:    { type: Number },
    startedAt:        { type: Date },
    completedAt:      { type: Date },
    postponeCount:    { type: Number, default: 0 },
    postponeReasons:  { type: [String], default: [] },
    postponedAt:      { type: [Date], default: [] },
    timerSessions:    { type: [TimerSessionSchema], default: [] },
    notes:            { type: String, default: '' },
    subtasks:         { type: [SubtaskSchema], default: [] },
    isRecurring:      { type: Boolean, default: false },
    recurringId:      { type: Schema.Types.ObjectId, ref: 'RecurringTask' },
    isAbandoned:      { type: Boolean, default: false },
    sortOrder:        { type: Number },
  },
  { timestamps: true }
);

// Indexes
TaskSchema.index({ date: 1 });
TaskSchema.index({ date: 1, status: 1 });            // carryover: { date: $lt, status: $in }
TaskSchema.index({ date: 1, recurringId: 1 });        // recurring dedup check
TaskSchema.index({ status: 1, completedAt: -1 });     // done tasks sorted by completion
TaskSchema.index({ status: 1, postponeCount: -1 });   // frog: { status: $ne done } sort postponeCount
TaskSchema.index({ completedAt: 1 });                 // heatmap aggregation on completedAt
TaskSchema.index({ postponeCount: -1 });
TaskSchema.index({ tag: 1, status: 1 });
TaskSchema.index({ postponedAt: 1 });                 // procrastination pattern aggregation

const Task: Model<ITask> =
  mongoose.models.Task ?? mongoose.model<ITask>('Task', TaskSchema);

export default Task;
