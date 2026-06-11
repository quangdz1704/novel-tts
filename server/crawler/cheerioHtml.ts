import * as cheerio from 'cheerio';
import type {
  HtmlDocument,
  HtmlNode,
} from '../../src/core/sources/parsers/html';

class CheerioHtmlNode implements HtmlNode {
  constructor(
    protected readonly root: cheerio.CheerioAPI,
    protected readonly selection: cheerio.Cheerio<any>,
  ) {}

  attr(name: string) {
    return this.selection.attr(name);
  }

  find(selector: string) {
    const found = this.selection.find(selector).first();
    return found.length ? new CheerioHtmlNode(this.root, found) : undefined;
  }

  findAll(selector: string) {
    return this.selection
      .find(selector)
      .toArray()
      .map(
        (element) =>
          new CheerioHtmlNode(this.root, this.root(element)),
      );
  }

  html() {
    return this.selection.html() || '';
  }

  text() {
    return this.selection.text();
  }
}

class CheerioHtmlDocument extends CheerioHtmlNode implements HtmlDocument {
  constructor(root: cheerio.CheerioAPI) {
    super(root, root.root());
  }

  title() {
    return this.root('title').first().text();
  }
}

export function parseCheerioHtml(html: string): HtmlDocument {
  return new CheerioHtmlDocument(cheerio.load(html));
}
