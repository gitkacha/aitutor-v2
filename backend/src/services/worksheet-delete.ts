import prisma from '../lib/prisma';

// W-83/W-84: delete a worksheet only if it has NO attempts — so deletion can never orphan an
// attempt. Shared by the HTTP routes and the coach-chat delete_worksheet action tool so the guard
// and messaging stay identical.
export type DeleteWorksheetResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

export async function deleteWorksheetIfUnattempted(
  subject: 'math' | 'writing',
  id: number,
  workspaceId: number,
): Promise<DeleteWorksheetResult> {
  if (subject === 'math') {
    const ws = await prisma.mathWorksheet.findFirst({ where: { id, workspaceId } });
    if (!ws) return { ok: false, status: 404, error: 'Worksheet not found' };
    const attempts = await prisma.mathAttempt.count({ where: { worksheetId: id } });
    if (attempts > 0) return { ok: false, status: 409, error: 'This worksheet has attempts and cannot be deleted.' };
    await prisma.mathWorksheet.delete({ where: { id } });
    return { ok: true };
  }
  const ws = await prisma.worksheet.findFirst({ where: { id, workspaceId } });
  if (!ws) return { ok: false, status: 404, error: 'Worksheet not found' };
  const attempts = await prisma.attempt.count({ where: { worksheetId: id } });
  if (attempts > 0) return { ok: false, status: 409, error: 'This worksheet has attempts and cannot be deleted.' };
  await prisma.worksheet.delete({ where: { id } });
  return { ok: true };
}
