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
const memoryStorage = new Map<string, string>();

function getItem(key: string) {
  return typeof localStorage === 'undefined'
    ? memoryStorage.get(key) || null
    : localStorage.getItem(key);
}

function setItem(key: string, value: string) {
  if (typeof localStorage === 'undefined') {
    memoryStorage.set(key, value);
    return;
  }
  localStorage.setItem(key, value);
}

function readStringList(key: string) {
  try {
    return JSON.parse(getItem(key) || '[]') as string[];
  } catch {
    return [];
  }
}

function rememberLibraryEntry(path: string) {
  const match = path.match(/library\/([^/]+)\//);
  const novelId = match?.[1];
  if (!novelId) return;
  const current = readStringList(WEB_NOVEL_INDEX);
  if (!current.includes(novelId)) {
    setItem(WEB_NOVEL_INDEX, JSON.stringify([...current, novelId]));
  }

  const chapter = path.match(/library\/[^/]+\/chapters\/([^/]+)\.json$/)?.[1];
  if (chapter) {
    const key = `${WEB_CHAPTER_INDEX_PREFIX}${novelId}`;
    const chapters = readStringList(key);
    if (!chapters.includes(chapter)) {
      setItem(key, JSON.stringify([...chapters, chapter]));
    }
  }
}

export async function getLibraryPath() {
  return 'library';
}

export async function ensureNovelDir(novelId: string) {
  const base = await getLibraryPath();
  return joinPath(base, novelId);
}

export async function writeJsonFile(path: string, data: any) {
  const content = JSON.stringify(data, null, 2);
  setItem(`${WEB_FILE_PREFIX}${path}`, content);
  rememberLibraryEntry(path);
}

export async function readJsonFile(path: string) {
  try {
    const text = getItem(`${WEB_FILE_PREFIX}${path}`);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function listNovels() {
  return readStringList(WEB_NOVEL_INDEX);
}

export async function listChapters(novelId: string) {
  return readStringList(`${WEB_CHAPTER_INDEX_PREFIX}${novelId}`);
}
