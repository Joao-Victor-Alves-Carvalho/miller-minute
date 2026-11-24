import { describe, expect, it } from 'vitest';
import { BadRequest, chatSystem, corsHeaders, handle, parseTurns, sameCode, type Ask } from './logic';

function fakeAsk(text: string, refused = false) {
  const calls: Parameters<Ask>[0][] = [];
  const ask: Ask = async (req) => {
    calls.push(req);
    return { text, refused };
  };
  return { ask, calls };
}

const env = { ANTHROPIC_API_KEY: 'k', APP_ACCESS_CODE: 'c' };

describe('servidor da IA', () => {
  it('código de acesso: compara em tempo constante e recusa vazio', () => {
    expect(sameCode('abc123', 'abc123')).toBe(true);
    expect(sameCode('abc123', 'abc124')).toBe(false);
    expect(sameCode('', '')).toBe(false);
    expect(sameCode('abc', 'abcd')).toBe(false);
  });

  it('CORS só libera as origens do app', () => {
    expect(corsHeaders('https://joao-victor-alves-carvalho.github.io', env)['Access-Control-Allow-Origin']).toBe('https://joao-victor-alves-carvalho.github.io');
    expect(corsHeaders('https://site-estranho.com', env)['Access-Control-Allow-Origin']).not.toBe('https://site-estranho.com');
  });

  it('/chat: abre a chamada, usa as palavras do aprendiz e responde curto', async () => {
    const { ask, calls } = fakeAsk(' Hi! How was your day? ');
    const out = await handle('/chat', { messages: [], words: ['coffee', 'kitchen'], level: 'A2' }, ask);
    expect(out.reply).toBe('Hi! How was your day?');
    expect(calls[0]?.messages[0]?.role).toBe('user');
    expect(calls[0]?.effort).toBe('low');
    expect(calls[0]?.schema).toBeUndefined();
    expect(calls[0]?.system).toContain('coffee, kitchen');
  });

  it('/chat: a última fala precisa ser do aprendiz e o histórico é limitado', async () => {
    const { ask } = fakeAsk('ok');
    await expect(handle('/chat', { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] }, ask)).rejects.toBeInstanceOf(BadRequest);
    const long = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(5000) }));
    expect(parseTurns(long)).toHaveLength(60);
    expect(parseTurns(long)[0]?.content.length).toBe(1200);
    expect(() => parseTurns([{ role: 'system', content: 'x' }])).toThrow(BadRequest);
  });

  it('/chat: recusa de segurança vira uma resposta neutra', async () => {
    const { ask } = fakeAsk('', true);
    const out = await handle('/chat', { messages: [{ role: 'user', content: 'hi' }] }, ask);
    expect(out.refused).toBe(true);
    expect(typeof out.reply).toBe('string');
  });

  it('/report e /correct pedem JSON com schema e devolvem o objeto', async () => {
    const report = { summary_pt: 'ok', mistakes: [{ said: 'I have 20 years', better: 'I am 20 years old', why_pt: 'idade usa be' }], new_words: [], encouragement_pt: 'boa' };
    const r = fakeAsk(JSON.stringify(report));
    const out = await handle('/report', { messages: [{ role: 'user', content: 'I have 20 years' }] }, r.ask);
    expect(out).toEqual(report);
    expect(r.calls[0]?.schema).toBeDefined();
    expect(r.calls[0]?.messages[0]?.content).toContain('LEARNER: I have 20 years');

    const p = fakeAsk(JSON.stringify({ en: 'Break a leg!', pt: 'Boa sorte!', explanation_pt: 'expressão', example: 'Break a leg tonight!' }));
    const phrase = await handle('/correct', { kind: 'phrase', text: 'brake a leg', context: 'série' }, p.ask);
    expect(phrase.en).toBe('Break a leg!');
    expect(p.calls[0]?.messages[0]?.content).toContain('série');
    await expect(handle('/correct', { kind: 'poem', text: 'x' }, p.ask)).rejects.toBeInstanceOf(BadRequest);
    await expect(handle('/correct', { kind: 'diary', text: '  ' }, p.ask)).rejects.toBeInstanceOf(BadRequest);
    await expect(handle('/nada', {}, p.ask)).rejects.toBeInstanceOf(BadRequest);
  });

  it('o prompt da conversa pede inglês simples, curto e sem correção explícita', () => {
    const s = chatSystem({ level: 'A2', words: [] });
    expect(s).toContain('ONLY in English');
    expect(s).toContain('recast');
  });
});
