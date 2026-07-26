// W-74: reverse-map worksheet id → the intervention that paired it, from the interventions'
// stored `worksheetIds` JSON. Used to stamp each worksheet in the list endpoints with its
// `interventionId`, so the student's pending list can flag the specific worksheet whose paired
// coaching lesson is still incomplete ("best after the lesson").
//
// `worksheetIds` is stored as either `{ math?: number[]; writing?: number[] }` (§6.2) or a flat
// `number[]` (the chat create_intervention tool). A flat array is treated as math ids — chat
// worksheet generation is math-only today.
export function buildWorksheetInterventionMap(
  interventions: { id: number; worksheetIds: string }[],
  subject: 'math' | 'writing',
): Map<number, number> {
  const map = new Map<number, number>();
  for (const iv of interventions) {
    let ids: unknown = [];
    try {
      const parsed = JSON.parse(iv.worksheetIds);
      if (Array.isArray(parsed)) {
        ids = subject === 'math' ? parsed : [];
      } else if (parsed && typeof parsed === 'object') {
        ids = (parsed as Record<string, unknown>)[subject] ?? [];
      }
    } catch {
      ids = [];
    }
    if (Array.isArray(ids)) {
      for (const wid of ids) {
        if (typeof wid === 'number' && !map.has(wid)) map.set(wid, iv.id);
      }
    }
  }
  return map;
}
