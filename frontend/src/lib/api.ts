const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
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
  getHeatmap: () => fetchJSON<MathHeatmapEntry[]>('/math/heatmap'),
  generateWorksheet: (topicIds: string[], questionCount?: number) =>
    fetchJSON<{ topics: Array<{ id: number; name: string; slug: string }>; questions: GeneratedMathQuestion[] }>(
      '/math/worksheets/generate',
      { method: 'POST', body: JSON.stringify({ topicIds, questionCount }) }
    ),
  saveWorksheet: (title: string, topicIds: string[], questions: GeneratedMathQuestion[]) =>
    fetchJSON<MathWorksheet>('/math/worksheets/save', {
      method: 'POST',
      body: JSON.stringify({ title, topicIds, questions }),
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

export const api = {
  getTypes: () => fetchJSON<WritingType[]>('/types'),
  getType: (slug: string) => fetchJSON<WritingType>(`/types/${slug}`),
  getAttempts: (typeSlug?: string) =>
    fetchJSON<Attempt[]>(`/attempts${typeSlug ? `?type=${typeSlug}` : ''}`),
  getAttempt: (id: number) => fetchJSON<Attempt>(`/attempts/${id}`),
  createAttempt: (data: Partial<Attempt> & { text: string; promptId: number; typeId: number }) =>
    fetchJSON<Attempt>('/attempts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerAnalysis: (attemptId: number) =>
    fetchJSON<Analysis>(`/analysis/${attemptId}`, { method: 'POST' }),
  getHeatmap: () => fetchJSON<HeatmapEntry[]>('/heatmap'),
  generateWorksheet: (typeIds: number[]) =>
    fetchJSON<GenerateWritingWorksheetResponse>('/worksheets/generate', {
      method: 'POST',
      body: JSON.stringify({ typeIds }),
    }),
  saveWorksheet: (title: string, typeIds: number[], prompts: string[]) =>
    fetchJSON<Worksheet[]>('/worksheets/save', {
      method: 'POST',
      body: JSON.stringify({ title, typeIds, prompts }),
    }),
  getWorksheets: () => fetchJSON<Worksheet[]>('/worksheets'),
  loadDemo: () => fetchJSON<{ message: string }>('/demo/load', { method: 'POST' }),
  clearDemo: () => fetchJSON<{ message: string }>('/demo/clear', { method: 'POST' }),
};