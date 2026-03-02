
export interface User {
  id: string;
  email: string;
  full_name: string;
  xp: number;
  subjects_count: number;
}

export interface Lecture {
  id: number;
  title: string;
  type: 'file' | 'link';
  content: string; 
  date: string;
  isCompleted: boolean;
  notes?: string;
}

export interface Subject {
  id: number;
  name: string;
  color: string;
  progress: number;
  lectures: Lecture[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface Task {
  id: number;
  title: string;
  time: string;
  duration: string;
  status: 'upcoming' | 'completed' | 'urgent' | 'pending';
  dayIndex: number;
  subjectColor?: string;
}

export interface Note {
  id: number;
  title: string;
  text: string;
  translation?: string;
  category: string;
  date: string;
  created_at: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastReviewed?: string;
}

export interface StudyStats {
  sessionsCompleted: number;
  totalMinutes: number;
  topSubject: string;
  focusRate: number;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple' | 'boolean' | 'short' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: any;
  explanation: string;
}

export interface QuizSettings {
  title: string;
  description: string;
  timeLimit: number;
  showScore: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  language: 'ar' | 'en';
  difficulty: 'easy' | 'medium' | 'hard';
  requireLogin: boolean;
  maxAttempts: number;
}

export interface PublishedQuiz {
  id: string;
  creatorId?: string;
  settings: QuizSettings;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizResponse {
  id: string;
  quizId: string;
  studentName: string;
  studentEmail?: string;
  groupCode?: string;
  answers: Record<string, any>;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  timeSpent: number;
  deviceInfo: string;
}

export type PageId = 
  | 'dashboard' 
  | 'subjects' 
  | 'planner' 
  | 'timer' 
  | 'ai-assistant' 
  | 'mindmap' 
  | 'creator' 
  | 'voice' 
  | 'blackboard' 
  | 'editor' 
  | 'mynotes' 
  | 'pricing' 
  | 'privacy'
  | 'contact'
  | 'take-quiz';
