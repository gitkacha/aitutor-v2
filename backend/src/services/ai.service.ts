import prisma from '../lib/prisma';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/free';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnalysisResult {
  vocabScore: number;
  vocabComments: string;
  structureScore: number;
  structureComments: string;
  contentScore: number;
  contentComments: string;
  overallScore: number;
  summary: string;
}

function parseAnalysisResponse(content: string): AnalysisResult {
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall through to fallback
  }
  // Fallback if parsing fails
  return {
    vocabScore: 50,
    vocabComments: 'Analysis could not be parsed. Please try again.',
    structureScore: 50,
    structureComments: 'Analysis could not be parsed. Please try again.',
    contentScore: 50,
    contentComments: 'Analysis could not be parsed. Please try again.',
    overallScore: 50,
    summary: 'Analysis could not be completed.',
  };
}

export async function analyzeAttempt(attemptId: number): Promise<AnalysisResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { type: true, prompt: true },
  });

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  const prompt = `You are an expert writing tutor for the NSW Selective High School Placement Test.
Analyse the following student's writing piece and provide scores and feedback.

Text Type: ${attempt.type.name}
Expected Structure: ${attempt.type.expectedStructure}
Prompt: ${attempt.prompt.text}

Student's Writing:
---
${attempt.text}
---

Respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "vocabScore": <0-100>,
  "vocabComments": "<specific feedback about vocabulary, referencing the student's actual word choices>",
  "structureScore": <0-100>,
  "structureComments": "<specific feedback about structure and flow, referencing the student's actual structure>",
  "contentScore": <0-100>,
  "contentComments": "<specific feedback about content and how well it follows the expected structure, referencing the student's actual content>",
  "overallScore": <0-100>,
  "summary": "<2-3 sentence summary of the overall performance>"
}

All comments must reference specific parts of the student's text.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('No OPENROUTER_API_KEY set, using fallback analysis');
    return getFallbackAnalysis();
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'NSW Selective Writing Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error (${response.status}):`, errorText);
      return getFallbackAnalysis();
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    return parseAnalysisResponse(content);
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    return getFallbackAnalysis();
  }
}

function getFallbackAnalysis(): AnalysisResult {
  return {
    vocabScore: 0,
    vocabComments: 'Unable to analyse vocabulary. Please check your OpenRouter API key and try again.',
    structureScore: 0,
    structureComments: 'Unable to analyse structure. Please check your OpenRouter API key and try again.',
    contentScore: 0,
    contentComments: 'Unable to analyse content. Please check your OpenRouter API key and try again.',
    overallScore: 0,
    summary: 'Analysis could not be completed. Please ensure your API key is configured correctly in the .env file.',
  };
}

export async function generateWorksheetPrompts(typeIds: number[]): Promise<string[]> {
  const types = await prisma.writingType.findMany({
    where: { id: { in: typeIds } },
  });

  const typeDescriptions = types
    .map((t) => `${t.name}: ${t.expectedStructure}`)
    .join('\n');

  const prompt = `You are a writing tutor creating practice worksheets for a student preparing for the NSW Selective High School Placement Test.
The student needs practice with the following text type(s):

${typeDescriptions}

Generate 3 writing prompts that target these text types. Each prompt should be a complete, engaging topic suitable for a Year 6 student.
Respond with ONLY a JSON array of strings, no markdown, no code fences:
["prompt 1", "prompt 2", "prompt 3"]`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return [
      'Write a persuasive text arguing for or against school uniforms.',
      'Write a narrative about a surprising discovery.',
      'Write a discussion on whether homework should be banned.',
    ];
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'NSW Selective Writing Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      return getFallbackPrompts();
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return getFallbackPrompts();
  } catch {
    return getFallbackPrompts();
  }
}

function getFallbackPrompts(): string[] {
  return [
    'Write a persuasive text arguing for or against school uniforms.',
    'Write a narrative about a surprising discovery.',
    'Write a discussion on whether homework should be banned.',
  ];
}

export type { AnalysisResult };

// ── Math Worksheet Generation ────────────────────────────────────────────────

interface MathTopicForGen {
  id: number;
  name: string;
  slug: string;
  description: string;
  questions: Array<{
    id: number;
    questionText: string;
    options: string;
    correctIndex: number;
    explanation: string;
    percentCorrect: number | null;
  }>;
}

interface GeneratedMathQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName: string;
}

export async function generateMathWorksheetQuestions(topics: MathTopicForGen[]): Promise<GeneratedMathQuestion[]> {
  // Build difficulty exemplars from hardest seeded questions
  const exemplars = topics.map(t => {
    const hardest = t.questions[0];
    if (!hardest) return null;
    return {
      topic: t.name,
      percentCorrect: hardest.percentCorrect,
      question: hardest.questionText,
      options: hardest.options,
      explanation: hardest.explanation,
    };
  }).filter(Boolean);

  const prompt = `You are a mathematics tutor creating a practice worksheet for a student preparing for the NSW Selective High School Placement Test (Mathematical Reasoning section).

The worksheet should cover the following topic(s):
${topics.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Generate 35 five-option multiple-choice questions distributed across these topics. Each question must have exactly one correct answer and four plausible distractors.

DIFFICULTY REQUIREMENT: Each question must be at or above the difficulty of the hardest known reference question for its topic. Here are the hardest reference questions per topic (with their cohort % Correct — lower % = harder):

${exemplars.map(e => `- ${e.topic}: ${e.percentCorrect}% correct (hard). Example: "${e.question}"`).join('\n')}

For each question, provide a detailed "Question Feedback" style explanation in the same format as the reference paper.

Respond with ONLY a JSON array (no markdown, no code fences) in this exact format:
[
  {
    "questionText": "full question text including any tables or data",
    "options": ["A", "B", "C", "D", "E"],
    "correctIndex": 0,
    "explanation": "Step-by-step reasoning. Therefore, the answer is Option X.",
    "topicSlug": "${topics[0]?.slug || 'algebra'}",
    "topicName": "${topics[0]?.name || 'Algebra'}"
  }
]

Generate exactly 35 questions. Make sure distractors are plausible — they should be answers a student might get from common mistakes.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return getFallbackMathQuestions(topics);
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'NSW Selective Prep Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error (${response.status}):`, errorText);
      return getFallbackMathQuestions(topics);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      return parsed.slice(0, 35);
    }
    return getFallbackMathQuestions(topics);
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    return getFallbackMathQuestions(topics);
  }
}

function getFallbackMathQuestions(topics: MathTopicForGen[]): GeneratedMathQuestion[] {
  const fallback: GeneratedMathQuestion[] = [];
  const topicNames = topics.map(t => ({ slug: t.slug, name: t.name }));

  for (let i = 0; i < 35; i++) {
    const t = topicNames[i % topicNames.length];
    fallback.push({
      questionText: `Sample question ${i + 1} for ${t.name}. What is the value of 25 × 4?`,
      options: ['80', '100', '120', '125', '150'],
      correctIndex: 1,
      explanation: '25 × 4 = 100. Therefore, the answer is Option B.',
      topicSlug: t.slug,
      topicName: t.name,
    });
  }

  return fallback;
}