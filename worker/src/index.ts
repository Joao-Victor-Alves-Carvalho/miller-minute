/**
 * Cloudflare Worker do Miller Minute: guarda a chave da API (segredo ANTHROPIC_API_KEY,
 * configurado no painel da Cloudflare) e repassa só pedidos autorizados (X-Access-Code).
 */
import Anthropic from '@anthropic-ai/sdk';
import { BadRequest, corsHeaders, handle, MODEL, sameCode, type Ask, type Env } from './logic';

function makeAsk(env: Env): Ask {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return async ({ system, messages, maxTokens, effort, schema }) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      // Conversa: rápida e sem "pensar" (o Haiku 5.5 aceita desligar até o esforço high).
      // Relatórios e correções: pensamento adaptativo e JSON validado pelo schema.
      ...(schema
        ? { output_config: { effort, format: { type: 'json_schema' as const, schema } } }
        : { thinking: { type: 'disabled' as const }, output_config: { effort } }),
    });
    if (response.stop_reason === 'refusal') return { text: '', refused: true };
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return { text, refused: false };
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/health') return json({ ok: true, model: MODEL }, 200, cors);
    if (request.method !== 'POST') return json({ error: 'método não permitido' }, 405, cors);
    if (!env.ANTHROPIC_API_KEY || !env.APP_ACCESS_CODE) return json({ error: 'servidor sem configuração: faltam os segredos' }, 500, cors);
    if (!sameCode(request.headers.get('X-Access-Code') ?? '', env.APP_ACCESS_CODE)) return json({ error: 'código de acesso inválido' }, 401, cors);

    // Teste de conexão do app: confere o código sem chamar a IA (não gasta crédito).
    if (path === '/ping') return json({ ok: true, model: MODEL }, 200, cors);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'JSON inválido' }, 400, cors);
    }

    try {
      return json(await handle(path, body, makeAsk(env)), 200, cors);
    } catch (error) {
      if (error instanceof BadRequest) return json({ error: error.message }, 400, cors);
      if (error instanceof Anthropic.AuthenticationError) return json({ error: 'chave da API inválida (confira o segredo ANTHROPIC_API_KEY)' }, 502, cors);
      if (error instanceof Anthropic.RateLimitError) return json({ error: 'limite de uso da API atingido; tente daqui a pouco' }, 429, cors);
      if (error instanceof Anthropic.BadRequestError) return json({ error: 'a API recusou o pedido (pode ser o teto de gasto)' }, 502, cors);
      if (error instanceof Anthropic.APIError) return json({ error: `erro da API (${error.status ?? '?'})` }, 502, cors);
      if (error instanceof SyntaxError) return json({ error: 'resposta da IA em formato inesperado' }, 502, cors);
      return json({ error: 'erro inesperado' }, 500, cors);
    }
  },
};
