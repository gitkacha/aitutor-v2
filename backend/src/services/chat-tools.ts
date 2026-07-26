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
import { generateCoachingModuleContent } from './coaching.service';
import { deleteWorksheetIfUnattempted } from './worksheet-delete';

export interface ToolContext {
  workspaceId: number;
  adminId: number;
  // The ChatSession this tool run belongs to, when a chat drives it (Task 9). Threaded into
  // create_intervention so a mid-chat intervention is linked back to its conversation. Optional
  // because non-chat callers (and read-only dispatch) don't need it.
  sessionId?: number;
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
  {
    name: 'list_worksheets',
    description:
      'List the worksheets in this workspace with their attempt counts, so you can identify one to ' +
      'delete. Returns both math and writing worksheets. Only worksheets with 0 attempts can be deleted.',
    parameters: { type: 'object', properties: {}, required: [] },
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
  {
    name: 'assign_coaching',
    description:
      'Assign a coaching lesson for a math skill to a student. If no approved lesson exists for ' +
      'that skill yet, this generates a draft lesson for the admin to review and approve first — ' +
      'it is NOT assigned to the student until an approved lesson exists.',
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'integer', description: 'The id of the student to assign the lesson to.' },
        skillSlug: { type: 'string', description: 'The slug of the math skill the lesson teaches.' },
        interventionId: { type: 'integer', description: 'Optional id of the intervention this lesson supports.' },
      },
      required: ['studentId', 'skillSlug'],
    },
  },
  {
    name: 'delete_worksheet',
    description:
      'Delete an UNATTEMPTED worksheet (use list_worksheets to find its id). Refuses if the ' +
      'worksheet has any attempt, so a student\'s work is never lost.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', enum: ['math', 'writing'], description: 'The worksheet subject.' },
        worksheetId: { type: 'integer', description: 'The id of the worksheet to delete.' },
      },
      required: ['subject', 'worksheetId'],
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

    case 'list_worksheets': {
      const [math, writing] = await Promise.all([
        prisma.mathWorksheet.findMany({
          where: { workspaceId: ctx.workspaceId },
          select: { id: true, title: true, _count: { select: { attempts: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.worksheet.findMany({
          where: { workspaceId: ctx.workspaceId },
          select: { id: true, title: true, _count: { select: { attempts: true } } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return [
        ...math.map((w) => ({ id: w.id, subject: 'math', title: w.title, attemptCount: w._count.attempts })),
        ...writing.map((w) => ({ id: w.id, subject: 'writing', title: w.title, attemptCount: w._count.attempts })),
      ];
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
        chatSessionId: ctx.sessionId,
        skillSlugs: args.skillSlugs,
        recommendation: args.recommendation,
        rationale: args.rationale,
        worksheetIds: args.worksheetIds,
      });
    }

    case 'assign_coaching': {
      const skill = await prisma.skill.findFirst({ where: { slug: args.skillSlug, subject: 'math' } });
      if (!skill) throw new Error(`Math skill not found: ${args.skillSlug}`);
      await assertStudentInWorkspace(args.studentId, ctx);

      // Only an approved lesson is assignable. If none exists, generate a draft for review —
      // the confirmation copy tells the admin it must be approved before the student sees it.
      const approved = await prisma.coachingModule.findFirst({
        where: { skillId: skill.id, workspaceId: ctx.workspaceId, status: 'approved' },
        orderBy: { version: 'desc' },
      });
      if (!approved) {
        const gen = await generateCoachingModuleContent({
          name: skill.name,
          slug: skill.slug,
          examLevelNotes: skill.examLevelNotes,
        });
        const draft = await prisma.coachingModule.create({
          data: { workspaceId: ctx.workspaceId, skillId: skill.id, title: gen.title, content: gen.content, status: 'draft' },
        });
        return { generatedDraft: true, needsApproval: true, moduleId: draft.id, verifierWarnings: gen.verifierWarnings };
      }

      // Idempotent on @@unique([moduleId, studentId]) — re-assigning is a no-op update.
      const assignment = await prisma.coachingAssignment.upsert({
        where: { moduleId_studentId: { moduleId: approved.id, studentId: args.studentId } },
        update: {},
        create: { moduleId: approved.id, studentId: args.studentId, interventionId: args.interventionId ?? null },
      });
      return { assigned: true, moduleId: approved.id, assignmentId: assignment.id };
    }

    case 'delete_worksheet': {
      const subject = args.subject === 'writing' ? 'writing' : 'math';
      const result = await deleteWorksheetIfUnattempted(subject, Number(args.worksheetId), ctx.workspaceId);
      if (!result.ok) throw new Error(result.error);
      return { deleted: true, subject, worksheetId: Number(args.worksheetId) };
    }

    default:
      throw new Error(`Unknown action tool: ${name}`);
  }
}
