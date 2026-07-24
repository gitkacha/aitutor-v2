// Chat read-tool schemas + dispatcher for the admin analytics chat assistant (Milestone 3b).
//
// READ_TOOL_SCHEMAS describe tools the model may call to look up data (workspace-scoped,
// read-only, safe to auto-execute). ACTION_TOOL_SCHEMAS describe tools that create or change
// data (worksheet generation/assignment, interventions) — schemas only here; Task 6 wires their
// executors and Task 7/9 wire confirmation flow. dispatchReadTool executes a READ tool by name.
import prisma from '../lib/prisma';
import { ChatToolSchema, generateMathWorksheetQuestions, resolveMathTopicsForGeneration } from './ai.service';
import { getStudentSkillReport, getOpportunityAreas } from './analytics.service';
import { validateWorksheetQuestions, saveAndAssignWorksheet } from './math-worksheet.service';
import { resolveAssigneeStudentIdsForWorkspace } from '../lib/scope';
import { createIntervention, listInterventions } from './intervention.service';

export interface ToolContext {
  workspaceId: number;
  adminId: number;
}

export const READ_TOOL_SCHEMAS: ChatToolSchema[] = [
  {
    name: 'list_students',
    description: 'List all students in the current workspace, with their id, name and email.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_student_skill_report',
    description:
      "Get a student's per-skill performance report (accuracy, evidence, trend) for a subject, " +
      'based on their most recent tests.',
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'integer', description: 'The id of the student to report on.' },
        subject: { type: 'string', enum: ['math', 'writing'], description: 'The subject to report on.' },
        lastNTests: {
          type: 'integer',
          description: 'How many of the student\'s most recent tests to include (defaults to the standard analysis window).',
        },
      },
      required: ['studentId', 'subject'],
    },
  },
  {
    name: 'get_opportunity_areas',
    description:
      'Get the ranked list of weakest skills (opportunity areas) for a subject — either for one ' +
      'student, or workspace-wide across all students when no student is given.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', enum: ['math', 'writing'], description: 'The subject to analyse.' },
        studentId: {
          type: 'integer',
          description: 'Optional student id to scope the analysis to. Omit for a workspace-wide cohort ranking.',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'get_attempt_details',
    description: 'Get the full detail of one completed math attempt, including its questions, answers and scoring breakdown.',
    parameters: {
      type: 'object',
      properties: {
        attemptId: { type: 'integer', description: 'The id of the math attempt to fetch.' },
      },
      required: ['attemptId'],
    },
  },
  {
    name: 'get_intervention_history',
    description: 'Get the history of coaching interventions previously created for a student.',
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'integer', description: 'The id of the student whose intervention history to fetch.' },
      },
      required: ['studentId'],
    },
  },
];

export const ACTION_TOOL_SCHEMAS: ChatToolSchema[] = [
  {
    name: 'generate_worksheet',
    description: 'Generate a new AI-authored worksheet for a subject, targeting given topics and/or skills.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', enum: ['math', 'writing'], description: 'The subject to generate a worksheet for.' },
        topicSlugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of topic slugs to target.',
        },
        skillSlugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of skill slugs to target.',
        },
        questionCount: {
          type: 'integer',
          minimum: 5,
          maximum: 50,
          description: 'Number of questions to include in the worksheet (5-50).',
        },
      },
      required: ['subject', 'questionCount'],
    },
  },
  {
    name: 'save_and_assign_worksheet',
    description: 'Save a previously generated worksheet and assign it to one or more students.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The worksheet title.' },
        questions: {
          type: 'array',
          items: { type: 'object' },
          description: 'The worksheet questions, as generated.',
        },
        topicIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'The topic ids covered by the worksheet.',
        },
        studentIds: {
          type: 'array',
          items: { type: 'integer' },
          description: 'The ids of the students to assign the worksheet to.',
        },
      },
      required: ['title', 'questions', 'topicIds', 'studentIds'],
    },
  },
  {
    name: 'create_intervention',
    description: 'Record a coaching intervention (recommendation + rationale) for a student, optionally linked to worksheets.',
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'integer', description: 'The id of the student the intervention is for.' },
        skillSlugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'The skill slugs this intervention targets.',
        },
        recommendation: { type: 'string', description: 'The recommended action for the student.' },
        rationale: { type: 'string', description: 'Why this intervention is recommended, based on the data.' },
        worksheetIds: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Optional ids of worksheets associated with this intervention.',
        },
      },
      required: ['studentId', 'skillSlugs', 'recommendation', 'rationale'],
    },
  },
];

const ACTION_TOOL_NAMES = new Set(ACTION_TOOL_SCHEMAS.map((t) => t.name));

export function isActionTool(name: string): boolean {
  return ACTION_TOOL_NAMES.has(name);
}

// Verify the target student belongs to ctx.workspaceId; throws if not found or out of scope.
async function assertStudentInWorkspace(studentId: number, ctx: ToolContext): Promise<void> {
  const student = await prisma.user.findFirst({ where: { id: studentId, workspaceId: ctx.workspaceId } });
  if (!student) throw new Error('Student not found in workspace');
}

export async function dispatchReadTool(name: string, args: any, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case 'list_students': {
      return prisma.user.findMany({
        where: { workspaceId: ctx.workspaceId, role: 'student' },
        select: { id: true, name: true, email: true },
      });
    }

    case 'get_student_skill_report': {
      await assertStudentInWorkspace(args.studentId, ctx);
      return getStudentSkillReport(args.studentId, args.subject, args.lastNTests);
    }

    case 'get_opportunity_areas': {
      if (args.studentId != null) {
        await assertStudentInWorkspace(args.studentId, ctx);
      }
      return getOpportunityAreas(ctx.workspaceId, args.subject, args.studentId);
    }

    case 'get_attempt_details': {
      const attempt = await prisma.mathAttempt.findUnique({
        where: { id: args.attemptId },
        include: { topic: true, worksheet: true },
      });
      if (!attempt) throw new Error('Attempt not found');
      await assertStudentInWorkspace(attempt.userId, ctx);

      const questionIds: number[] = JSON.parse(attempt.questions);
      const questions = await prisma.mathQuestion.findMany({
        where: { id: { in: questionIds } },
        include: { stimulusGroup: true, topic: true },
      });
      const orderedQuestions = questionIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);

      return {
        ...attempt,
        questionDetails: orderedQuestions,
        answersArray: JSON.parse(attempt.answers),
        breakdown: JSON.parse(attempt.topicBreakdown),
      };
    }

    case 'get_intervention_history': {
      await assertStudentInWorkspace(args.studentId, ctx);
      return listInterventions(args.studentId);
    }

    default:
      throw new Error(`Unknown read tool: ${name}`);
  }
}

// Clamp to the schema's declared 5–50 range (same clamp as the POST /generate route).
function clampQuestionCount(raw: unknown): number {
  return Math.max(5, Math.min(50, parseInt(String(raw), 10) || 35));
}

// Executes a confirmable action tool AFTER the admin has confirmed it (the confirm route,
// Task 9, calls this then deletes the pending action). Reuses the same generation/save
// services the HTTP routes use so behaviour and validation stay identical. Errors propagate
// to the caller. Scoped to ctx.workspaceId / ctx.adminId throughout.
export async function executeActionTool(name: string, args: any, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case 'generate_worksheet': {
      if (args.subject && args.subject !== 'math') {
        throw new Error('generate_worksheet currently supports subject "math" only');
      }
      const questionCount = clampQuestionCount(args.questionCount);

      // Selection: explicit topicSlugs, plus the owning topics of any skillSlugs. Empty
      // set → generation covers every topic (resolveMathTopicsForGeneration's default).
      const slugSet = new Set<string>(Array.isArray(args.topicSlugs) ? args.topicSlugs : []);
      if (Array.isArray(args.skillSlugs) && args.skillSlugs.length > 0) {
        const skills = await prisma.skill.findMany({
          where: { slug: { in: args.skillSlugs }, subject: 'math' },
          select: { topic: { select: { slug: true } } },
        });
        for (const s of skills) if (s.topic) slugSet.add(s.topic.slug);
      }
      const topicSlugs = [...slugSet];

      const topics = await resolveMathTopicsForGeneration(topicSlugs);
      if (topics.length === 0) {
        throw new Error('No topics found for the requested selection');
      }

      const topicSummaries = topics.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
      const questions = await generateMathWorksheetQuestions(topics, questionCount);
      const title = `${topics.map((t) => t.name).join(', ')} practice`;
      return { title, topics: topicSummaries, questions };
    }

    case 'save_and_assign_worksheet': {
      if (!args.title || !validateWorksheetQuestions(args.questions)) {
        throw new Error(
          'save_and_assign_worksheet requires a title and a non-empty array of valid questions ' +
          '({questionText, options[], correctIndex, explanation, topicSlug, skillSlug})'
        );
      }
      const assigneeIds = await resolveAssigneeStudentIdsForWorkspace(ctx.workspaceId, args.studentIds);
      return saveAndAssignWorksheet({
        workspaceId: ctx.workspaceId,
        createdById: ctx.adminId,
        title: args.title,
        topicIds: args.topicIds,
        questions: args.questions,
        assigneeIds,
      });
    }

    case 'create_intervention': {
      await assertStudentInWorkspace(args.studentId, ctx);
      return createIntervention({
        workspaceId: ctx.workspaceId,
        studentId: args.studentId,
        createdById: ctx.adminId,
        skillSlugs: args.skillSlugs,
        recommendation: args.recommendation,
        rationale: args.rationale,
        worksheetIds: args.worksheetIds,
      });
    }

    default:
      throw new Error(`Unknown action tool: ${name}`);
  }
}
