import type {
  TranslatorProvider,
  TranslatorParams,
} from '../TranslatorProvider';

export class OpenAITranslator implements TranslatorProvider {
  name = 'OpenAI';

  constructor(private apiKey?: string) {}

  async translate(params: TranslatorParams): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key not configured');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: params.text }],
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content;
  }
}
