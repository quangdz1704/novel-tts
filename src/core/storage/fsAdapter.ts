import { appDir } from '@tauri-apps/api/path';
import {
  writeFile,
  readTextFile,
  createDir,
  readDir,
} from '@tauri-apps/api/fs';

function joinPath(...parts: string[]) {
  return parts
    .map((part, index) => {
      if (index === 0) return part.replace(/\\/g, '/');
      return part.replace(/(^\/|\/$)/g, '');
    })
    .join('/')
    .replace(/\\/g, '/');
}

export async function getLibraryPath() {
  try {
    const dir = await appDir();
    const base = joinPath(dir, 'novel_tts', 'library');
    return base;
  } catch (e) {
    return 'library';
  }
}

export async function ensureNovelDir(novelId: string) {
  const base = await getLibraryPath();
  const dir = joinPath(base, novelId);
  try {
    await createDir(dir, { recursive: true });
    // ensure chapters subdir exists
    try {
      await createDir(joinPath(dir, 'chapters'), { recursive: true });
    } catch (e) {}
  } catch (e) {}
  return dir;
}

export async function writeJsonFile(path: string, data: any) {
  const content = JSON.stringify(data, null, 2);
  await writeFile({ path, contents: content });
}

export async function readJsonFile(path: string) {
  try {
    const text = await readTextFile(path);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

export async function listNovels() {
  const base = await getLibraryPath();
  try {
    const items = await readDir(base);
    return items.map((i) => i.name);
  } catch (e) {
    return [];
  }
}
