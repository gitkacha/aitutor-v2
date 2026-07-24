// Chat read-tool schemas + dispatcher for the admin analytics chat assistant (Milestone 3b).
//
// READ_TOOL_SCHEMAS describe tools the model may call to look up data (workspace-scoped,
// read-only, safe to auto-execute). ACTION_TOOL_SCHEMAS describe tools that create or change
// data (worksheet generation/assignment, interventions) — schemas only here; Task 6 wires their
// executors and Task 7/9 wire confirmation flow. dispatchReadTool executes a READ tool by name.
import prisma from '../lib/prisma';
import { ChatToolSchema } from './ai.service';
import { getStudentSkillReport, getOpportunityAreas } from './analytics.service';

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
      // Task 8 wires intervention.service to return real history; placeholder until then.
      return [];
    }

    default:
      throw new Error(`Unknown read tool: ${name}`);
  }
}
