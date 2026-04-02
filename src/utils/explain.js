import Anthropic from '@anthropic-ai/sdk';

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

const client = new Anthropic({
  apiKey: apiKey || '',
  dangerouslyAllowBrowser: true,
});

const cache = new Map();

/**
 * Generate a short contextual explanation of a Japanese word within its sentence.
 * Results are cached in-memory for the session — repeat clicks cost nothing.
 * @param {string} word     - surface or dictionary form
 * @param {string} reading  - hiragana reading
 * @param {string} sentence - full sentence the word appears in
 * @returns {Promise<string>} 1-2 sentence explanation in English
 */
export async function explainWord(word, reading, sentence) {
  if (!apiKey) return null;

  const key = `${word}||${sentence}`;
  if (cache.has(key)) return cache.get(key);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Japanese sentence: "${sentence}"
Word: "${word}"${reading ? ` (${reading})` : ''}

In 1-2 short sentences, explain what "${word}" means in this specific context. Be natural and direct — no "In this context" filler, just explain it plainly.`,
      },
    ],
  });

  const result = (response.content[0]?.text ?? '').trim() || null;
  cache.set(key, result);
  return result;
}
