const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'nav',
  'aside',
  'footer',
  'header',
]);

const CONTENT_SELECTORS = [
  '#chapter-content',
  '#content',
  '.chapter-content',
  '.read-content',
  '.reading-content',
  '.entry-content',
  'article',
  'main',
];

export function toSafeId(value: string, fallback = 'item') {
  const safe = value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return safe || fallback;
}

export function sanitizeHtml(html: string) {
  if (typeof document === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((node) => {
    const el = node as HTMLElement;
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        value.startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

export function extractReadableContent(html: string) {
  if (typeof DOMParser === 'undefined') {
    return sanitizeHtml(html);
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const contentEl = CONTENT_SELECTORS.map((selector) =>
    doc.querySelector(selector),
  ).find(Boolean);
  const content = contentEl?.innerHTML || doc.body?.innerHTML || html;
  return sanitizeHtml(content);
}

export function htmlToText(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}
