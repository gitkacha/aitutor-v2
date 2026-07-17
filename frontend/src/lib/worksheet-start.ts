import { WritingType, Worksheet } from './api';

// Router state for starting a writing worksheet — shared by PracticeHome,
// PendingWorksheets and the sidebar's "Up next" card. The prompt object is
// display-only: the backend resolves the attempt's real Prompt row from the
// worksheetId (H4), so no bank prompt is ever attached to a worksheet attempt.
export function worksheetStartState(type: WritingType, ws: Worksheet) {
  let prompts: string[] = [];
  try {
    prompts = JSON.parse(ws.prompts || '[]');
  } catch {
    prompts = [];
  }
  const promptText = prompts[0] || '';
  return {
    prompt: { id: 0, text: promptText, typeId: type.id },
    type,
    worksheetId: ws.id,
    worksheetPromptText: promptText,
  };
}
