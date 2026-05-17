import OpenAI from 'openai';
import { getStoredKey } from './providers';
import { getDb, saveDb } from './database';

const EXTRACTION_PROMPT = `Analise esta conversa e extraia APENAS informações duráveis sobre o usuário ou empresa que seriam úteis em conversas futuras. Exemplos:
- Preferências do usuário (idioma, formato, tom)
- Fatos sobre a empresa (nome, equipe, processos)
- Decisões tomadas
- Ferramentas/sistemas que usa
- Convenções ou padrões

Responda APENAS com um JSON array de objetos: [{"content": "...", "category": "user|project|feedback|reference"}]
Se não houver nada relevante para salvar, responda: []
Máximo 3 itens. Seja conciso em cada item (1-2 frases).`;

interface Message {
  role: string;
  content: string;
}

export async function autoExtractMemory(messages: Message[]): Promise<void> {
  if (messages.length < 4) return;

  const apiKey = getStoredKey('openai');
  if (!apiKey) return;

  const lastMessages = messages.slice(-10);
  const conversationText = lastMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: conversationText },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content?.trim() || '[]';
    let insights: Array<{ content: string; category: string }> = [];
    try {
      insights = JSON.parse(text);
    } catch {
      return;
    }

    if (!Array.isArray(insights) || insights.length === 0) return;

    const db = getDb();
    if (!db) return;

    const existingRows = db.exec('SELECT content FROM memories');
    const existingContents = existingRows.length > 0
      ? existingRows[0].values.map(r => (r[0] as string).toLowerCase())
      : [];

    let saved = 0;
    for (const insight of insights.slice(0, 3)) {
      if (!insight.content || !insight.category) continue;

      const isDuplicate = existingContents.some(existing => {
        const words = insight.content.toLowerCase().split(' ');
        const matchCount = words.filter(w => existing.includes(w)).length;
        return matchCount / words.length > 0.8;
      });

      if (isDuplicate) continue;

      const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const category = ['user', 'project', 'feedback', 'reference'].includes(insight.category)
        ? insight.category : 'general';

      db.run(
        `INSERT INTO memories (id, content, category, created_at) VALUES (?, ?, ?, datetime('now'))`,
        [id, `[auto] ${insight.content}`, category]
      );
      saved++;
    }

    if (saved > 0) saveDb();
  } catch {}
}
