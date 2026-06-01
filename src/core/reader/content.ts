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

const READABLE_BLOCK_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
].join(',');

export type ReadableBlock = {
  html: string;
  text: string;
};

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

export function htmlToReadableBlocks(html: string): ReadableBlock[] {
  const safeHtml = sanitizeHtml(html);
  if (typeof document === 'undefined') {
    return htmlToText(safeHtml)
      .split(/\n{2,}/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ html: text, text }));
  }

  const template = document.createElement('template');
  template.innerHTML = safeHtml;
  const blockEls = Array.from(
    template.content.querySelectorAll<HTMLElement>(READABLE_BLOCK_SELECTOR),
  );

  const blocks = blockEls
    .map((el) => ({
      html: el.outerHTML,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((block) => block.text);

  if (blocks.length) return blocks;

  return htmlToText(safeHtml)
    .split(/\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ html: `<p>${escapeHtml(text)}</p>`, text }));
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
