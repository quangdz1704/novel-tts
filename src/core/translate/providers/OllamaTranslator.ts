import type {
  TranslatorProvider,
  TranslatorParams,
} from '../TranslatorProvider';

export class OllamaTranslator implements TranslatorProvider {
  name = 'Ollama';

  constructor(private baseUrl = 'http://localhost:11434') {}

  async translate(params: TranslatorParams): Promise<string> {
    // Example Ollama API usage; requires local Ollama server
    const resp = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama2', prompt: params.text }),
    });
    if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
    const data = await resp.json();
    return data.output || '';
  }
}
