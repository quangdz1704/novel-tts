export interface TranslatorParams {
  text: string;
  glossary?: any[];
  style?: string;
}

export interface TranslatorProvider {
  name: string;
  translate(params: TranslatorParams): Promise<string>;
}
