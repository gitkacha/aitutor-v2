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
    fetchJSON<Worksheet>('/worksheets/generate', {
      method: 'POST',
      body: JSON.stringify({ typeIds }),
    }),
  getWorksheets: () => fetchJSON<Worksheet[]>('/worksheets'),
  loadDemo: () => fetchJSON<{ message: string }>('/demo/load', { method: 'POST' }),
  clearDemo: () => fetchJSON<{ message: string }>('/demo/clear', { method: 'POST' }),
};