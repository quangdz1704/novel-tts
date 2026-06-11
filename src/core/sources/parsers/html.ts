export interface HtmlNode {
  attr(name: string): string | undefined;
  find(selector: string): HtmlNode | undefined;
  findAll(selector: string): HtmlNode[];
  html(): string;
  text(): string;
}

export interface HtmlDocument extends HtmlNode {
  title(): string;
}
