import type { StimulusSpec } from './stimulus';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  // Content-Type only makes sense on requests that carry a body (W-5).
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface WritingType {
  id: number;
  name: string;
  slug: string;
  description: string;
  expectedStructure: string;
  prompts?: Prompt[];
}

export interface Prompt {
  id: number;
  text: string;
  typeId: number;
}

export interface Attempt {
  id: number;
  typeId: number;
  promptId: number;
  text: string;
  startedAt: string;
  finishedAt: string;
  timeTaken: number;
  source: string;
  worksheetId: number | null;
  analysis?: Analysis | null;
}

export interface Analysis {
  id: number;
  attemptId: number;
  vocabScore: number;
  vocabComments: string;
  structureScore: number;
  structureComments: string;
  contentScore: number;
  contentComments: string;
  overallScore: number;
  summary: string;
}

export interface HeatmapEntry {
  typeId: number;
  typeName: string;
  typeSlug: string;
  averageScore: number | null;
  attemptCount: number;
}

export interface Worksheet {
  id: number;
  title: string;
  typeId: number;
  prompts: string;
  createdAt: string;
  isDemo?: boolean;
  attempts?: Attempt[];
}

// ── Mathematics Types ──

export interface MathTopic {
  id: number;
  name: string;
  slug: string;
  description: string;
  isDemo: boolean;
  questions?: MathQuestionFull[];
}

export interface MathStimulusGroup {
  id: number;
  stimulus: string;
}

export interface MathQuestionFull {
  id: number;
  topicId: number;
  stimulusGroupId: number | null;
  questionText: string;
  options: string;
  correctIndex: number;
  explanation: string;
  percentCorrect: number | null;
  isDemo: boolean;
  topic: MathTopic;
  stimulusGroup: MathStimulusGroup | null;
}

export interface MathAttempt {
  id: number;
  topicId: number | null;
  questions: string;
  answers: string;
  topicBreakdown: string;
  score: number;
  totalQuestions: number;
  startedAt: string;
  finishedAt: string;
  timeTaken: number;
  source: string;
  worksheetId: number | null;
  isDemo: boolean;
  topic: MathTopic | null;
  questionDetails?: MathQuestionFull[];
  answersArray?: number[];
  breakdown?: Record<string, { correct: number; total: number }>;
}

export interface MathHeatmapEntry {
  topicId: number;
  topicName: string;
  topicSlug: string;
  averageScore: number | null;
  attemptCount: number;
}

export interface MathWorksheet {
  id: number;
  title: string;
  topicIds: string;
  questions: string;
  createdAt: string;
  isDemo?: boolean;
  attempts?: MathAttempt[];
}

// ── Math API ──

export interface GeneratedMathQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName: string;
  stimulus?: StimulusSpec;
}

export const mathApi = {
  getTopics: () => fetchJSON<MathTopic[]>('/math/topics'),
  getTopic: (slug: string) => fetchJSON<MathTopic>(`/math/topics/${slug}`),
  getQuestions: (opts?: { topicSlug?: string; worksheetId?: number }) => {
    const params = new URLSearchParams();
    if (opts?.topicSlug) params.set('topic', opts.topicSlug);
    if (opts?.worksheetId) params.set('worksheet', String(opts.worksheetId));
    const qs = params.toString();
    return fetchJSON<MathQuestionFull[]>(`/math/questions${qs ? `?${qs}` : ''}`);
  },
  getAttempts: (topicSlug?: string) =>
    fetchJSON<MathAttempt[]>(`/math/attempts${topicSlug ? `?topic=${topicSlug}` : ''}`),
  getAttempt: (id: number) => fetchJSON<MathAttempt>(`/math/attempts/${id}`),
  createAttempt: (data: {
    topicId?: number | null;
    questions: string;
    answers: string;
    startedAt: string;
    finishedAt: string;
    timeTaken: number;
    source?: string;
    worksheetId?: number;
  }) => fetchJSON<MathAttempt>('/math/attempts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getHeatmap: (studentId?: number) =>
    fetchJSON<MathHeatmapEntry[]>(`/math/heatmap${studentId ? `?studentId=${studentId}` : ''}`),
  generateWorksheet: (topicIds: string[], questionCount?: number) =>
    fetchJSON<{ topics: Array<{ id: number; name: string; slug: string }>; questions: GeneratedMathQuestion[] }>(
      '/math/worksheets/generate',
      { method: 'POST', body: JSON.stringify({ topicIds, questionCount }) }
    ),
  saveWorksheet: (title: string, topicIds: string[], questions: GeneratedMathQuestion[], studentIds?: number[]) =>
    fetchJSON<MathWorksheet>('/math/worksheets/save', {
      method: 'POST',
      body: JSON.stringify({ title, topicIds, questions, studentIds }),
    }),
  getWorksheets: () => fetchJSON<MathWorksheet[]>('/math/worksheets'),
};

// ── Writing Worksheet (generation + review) ──

export interface GeneratedWritingPrompt {
  questionText: string;
  typeSlug: string;
  typeName: string;
}

export interface GenerateWritingWorksheetResponse {
  types: Array<{ id: number; name: string; slug: string }>;
  prompts: string[];
}

// ── Auth (Milestone 2) ──

export interface AuthUser {
  id: number;
  workspaceId: number;
  role: string; // 'admin' | 'student'
  name: string;
  email: string;
}

export const api = {
  login: (email: string, password: string) =>
    fetchJSON<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => fetchJSON<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => fetchJSON<{ user: AuthUser }>('/auth/me'),
  setupStatus: () => fetchJSON<{ needsSetup: boolean }>('/setup/status'),
  setup: (data: { workspaceName: string; name: string; email: string; password: string }) =>
    fetchJSON<{ user: AuthUser }>('/setup', { method: 'POST', body: JSON.stringify(data) }),
  getTypes: () => fetchJSON<WritingType[]>('/types'),
  getType: (slug: string) => fetchJSON<WritingType>(`/types/${slug}`),
  getAttempts: (typeSlug?: string) =>
    fetchJSON<Attempt[]>(`/attempts${typeSlug ? `?type=${typeSlug}` : ''}`),
  getAttempt: (id: number) => fetchJSON<Attempt>(`/attempts/${id}`),
  // promptId is omitted for worksheet attempts — the backend resolves the worksheet's prompt (H4).
  createAttempt: (data: Partial<Attempt> & { text: string; promptId?: number; typeId: number }) =>
    fetchJSON<Attempt>('/attempts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerAnalysis: (attemptId: number) =>
    fetchJSON<Analysis>(`/analysis/${attemptId}`, { method: 'POST' }),
  // studentId (admin only, C1) scopes a heatmap to one workspace student.
  getHeatmap: (studentId?: number) =>
    fetchJSON<HeatmapEntry[]>(`/heatmap${studentId ? `?studentId=${studentId}` : ''}`),
  getStats: () => fetchJSON<{ sessionsThisWeek: number }>('/stats'),
  generateWorksheet: (typeIds: number[]) =>
    fetchJSON<GenerateWritingWorksheetResponse>('/worksheets/generate', {
      method: 'POST',
      body: JSON.stringify({ typeIds }),
    }),
  // studentIds (C1) targets specific students; omitted assigns to every student.
  saveWorksheet: (title: string, typeIds: number[], prompts: string[], studentIds?: number[]) =>
    fetchJSON<Worksheet[]>('/worksheets/save', {
      method: 'POST',
      body: JSON.stringify({ title, typeIds, prompts, studentIds }),
    }),
  getWorksheets: () => fetchJSON<Worksheet[]>('/worksheets'),
  loadDemo: () => fetchJSON<{ message: string }>('/demo/load', { method: 'POST' }),
  clearDemo: () => fetchJSON<{ message: string }>('/demo/clear', { method: 'POST' }),
  // Workspace member management (C1) — admin only.
  getWorkspaceUsers: () => fetchJSON<{ users: AuthUser[] }>('/workspace/users'),
  createWorkspaceUser: (data: { name: string; email: string; password: string; role: string }) =>
    fetchJSON<{ user: AuthUser }>('/workspace/users', { method: 'POST', body: JSON.stringify(data) }),
};