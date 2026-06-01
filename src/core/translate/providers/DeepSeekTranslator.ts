import type {
  TranslatorProvider,
  TranslatorParams,
} from '../TranslatorProvider';

export class DeepSeekTranslator implements TranslatorProvider {
  name = 'DeepSeek';

  constructor(private endpoint = 'https://api.deepseek.example') {}

  async translate(params: TranslatorParams): Promise<string> {
    // Placeholder: DeepSeek private API
    const resp = await fetch(`${this.endpoint}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: params.text, style: params.style }),
    });
    if (!resp.ok) throw new Error(`DeepSeek error: ${resp.status}`);
    const data = await resp.json();
    return data.translation || '';
  }
}
