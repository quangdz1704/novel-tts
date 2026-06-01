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

const WEB_FILE_PREFIX = 'novel_tts_file:';
const WEB_NOVEL_INDEX = 'novel_tts_web_novels';
const WEB_CHAPTER_INDEX_PREFIX = 'novel_tts_web_chapters:';

function canUseWebStorage() {
  return typeof localStorage !== 'undefined';
}

function rememberNovelFromPath(path: string) {
  if (!canUseWebStorage()) return;
  const match = path.match(/library\/([^/]+)\//);
  const novelId = match?.[1];
  if (!novelId) return;
  const current = JSON.parse(localStorage.getItem(WEB_NOVEL_INDEX) || '[]');
  if (!current.includes(novelId)) {
    localStorage.setItem(WEB_NOVEL_INDEX, JSON.stringify([...current, novelId]));
  }

  const chapter = path.match(/library\/[^/]+\/chapters\/([^/]+)\.json$/)?.[1];
  if (chapter) {
    const key = `${WEB_CHAPTER_INDEX_PREFIX}${novelId}`;
    const chapters = JSON.parse(localStorage.getItem(key) || '[]');
    if (!chapters.includes(chapter)) {
      localStorage.setItem(key, JSON.stringify([...chapters, chapter]));
    }
  }
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
  try {
    await writeFile({ path, contents: content });
  } catch (e) {
    if (!canUseWebStorage()) throw e;
    localStorage.setItem(`${WEB_FILE_PREFIX}${path}`, content);
    rememberNovelFromPath(path);
  }
}

export async function readJsonFile(path: string) {
  try {
    const text = await readTextFile(path);
    return JSON.parse(text);
  } catch (e) {
    try {
      if (!canUseWebStorage()) return null;
      const text = localStorage.getItem(`${WEB_FILE_PREFIX}${path}`);
      return text ? JSON.parse(text) : null;
    } catch (err) {
      return null;
    }
  }
}

export async function listNovels() {
  const base = await getLibraryPath();
  try {
    const items = await readDir(base);
    const fsItems = items.map((i) => i.name);
    if (!canUseWebStorage()) return fsItems;
    const webItems = JSON.parse(localStorage.getItem(WEB_NOVEL_INDEX) || '[]');
    return Array.from(new Set<string>([...fsItems, ...webItems]));
  } catch (e) {
    if (!canUseWebStorage()) return [];
    return JSON.parse(localStorage.getItem(WEB_NOVEL_INDEX) || '[]');
  }
}

export async function listChapters(novelId: string) {
  const base = await getLibraryPath();
  try {
    const items = await readDir(joinPath(base, novelId, 'chapters'));
    const fsChapters = items
      .map((i) => i.name)
      .filter((name): name is string => Boolean(name))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''));
    if (!canUseWebStorage()) return fsChapters;
    const webChapters = JSON.parse(
      localStorage.getItem(`${WEB_CHAPTER_INDEX_PREFIX}${novelId}`) || '[]',
    );
    return Array.from(new Set<string>([...fsChapters, ...webChapters]));
  } catch (e) {
    if (!canUseWebStorage()) return [];
    return JSON.parse(
      localStorage.getItem(`${WEB_CHAPTER_INDEX_PREFIX}${novelId}`) || '[]',
    );
  }
}
