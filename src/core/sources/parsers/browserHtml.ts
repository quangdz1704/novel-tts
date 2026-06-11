import type { HtmlDocument, HtmlNode } from './html';

class BrowserHtmlNode implements HtmlNode {
  constructor(protected readonly node: Element | Document) {}

  attr(name: string) {
    return this.node instanceof Element
      ? this.node.getAttribute(name) || undefined
      : undefined;
  }

  find(selector: string) {
    const found = this.node.querySelector(selector);
    return found ? new BrowserHtmlNode(found) : undefined;
  }

  findAll(selector: string) {
    return Array.from(this.node.querySelectorAll(selector)).map(
      (node) => new BrowserHtmlNode(node),
    );
  }

  html() {
    if (this.node instanceof Element) return this.node.innerHTML;
    return this.node.documentElement?.innerHTML || '';
  }

  text() {
    return this.node.textContent || '';
  }
}

class BrowserHtmlDocument extends BrowserHtmlNode implements HtmlDocument {
  constructor(private readonly documentNode: Document) {
    super(documentNode);
  }

  title() {
    return this.documentNode.title;
  }
}

export function parseBrowserHtml(html: string): HtmlDocument {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  return new BrowserHtmlDocument(documentNode);
}
