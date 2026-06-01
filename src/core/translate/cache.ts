import { writeJsonFile, readJsonFile } from '../storage/fsAdapter';

const CACHE_KEY_PREFIX = 'translate_cache:';

export async function getCached(key: string): Promise<string | null> {
  // try filesystem cache
  try {
    const path = `translate_cache/${encodeURIComponent(key)}.json`;
    const data = await readJsonFile(path);
    if (data && data.text) return data.text;
  } catch (e) {}

  // fallback to localStorage
  try {
    const v = localStorage.getItem(CACHE_KEY_PREFIX + key);
    return v;
  } catch (e) {
    return null;
  }
}

export async function setCached(key: string, text: string) {
  try {
    const path = `translate_cache/${encodeURIComponent(key)}.json`;
    await writeJsonFile(path, { text });
    return true;
  } catch (e) {
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + key, text);
    } catch (e) {}
    return false;
  }
}
