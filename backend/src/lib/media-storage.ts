import path from 'path';
import fs from 'fs';

// W-126: uploaded lesson media lives on local disk (the app runs locally). Kept out of git.
export const MEDIA_DIR = path.resolve(__dirname, '../../media');

export function ensureMediaDir(): void {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}
