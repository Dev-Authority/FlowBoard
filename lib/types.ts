export type TaskSize   = 'big' | 'small';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'postponed';
export type TaskTag    = 'work' | 'learning' | 'personal' | 'health';
export type Frequency  = 'daily' | 'weekdays' | 'every_x_days' | 'weekly' | 'biweekly' | 'monthly';

export interface TimerSession {
  start: string;
  end?: string;
}

export interface Subtask {
  _id: string;
  text: string;
  done: boolean;
}

export interface Task {
  _id: string;
  text: string;
  size: TaskSize;
  status: TaskStatus;
  tag: TaskTag;
  date: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  postponeCount: number;
  postponeReasons: string[];
  postponedAt: string[];
  timerSessions: TimerSession[];
  notes?: string;
  subtasks: Subtask[];
  isRecurring: boolean;
  recurringId?: string;
  isAbandoned?: boolean;
  sortOrder?: number;
  createdAt: string;
}

export interface RecurringTask {
  _id: string;
  text: string;
  size: TaskSize;
  tag: TaskTag;
  frequency: Frequency;
  frequencyValue?: number;
  isActive: boolean;
  streak: number;
  bestStreak: number;
  lastGeneratedDate?: string;
  createdAt: string;
}

export interface DailyReview {
  _id: string;
  date: string;
  whatGotDone: string;
  whatStoppedMe: string;
  createdAt: string;
}

export interface TagLimits {
  work: number;
  learning: number;
  personal: number;
  health: number;
}
