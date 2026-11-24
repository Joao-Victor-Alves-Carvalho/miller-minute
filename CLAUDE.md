# Miller Minute: instruções para o Claude

App de quiz pessoal do João para aprender inglês (nível básico). PWA em React + Vite +
TypeScript strict, sem backend. Plano e métodos em `docs/PLANO.md`.

- Conversa, código, commits e documentação em português do Brasil. Commits convencionais
  (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Staging por caminhos explícitos.
- Trabalhe em branch própria e entregue por pull request; nunca faça merge nem publique (deploy)
  sem o João pedir.
- Validação: `npm ci`, `npm run check`, `npm test`, `npm run build`. Nunca declarar testes
  aprovados sem executar. Testes automáticos não substituem o João testando no celular.
- Conteúdo: nunca mudar o texto em inglês de um item já publicado (forma o id do progresso);
  traduções e exemplos podem ser corrigidos. Novos pacotes entram no fim de `src/data/packs.ts`.
- Lógica de aprendizado fica em `src/lib/` como funções puras com testes.
- Preservar acessibilidade (foco visível, teclado, rótulos) e `prefers-reduced-motion`.
- Evitar dependências novas; se necessárias, explicar no PR.

## Filtro de metodologia (obrigatório para toda ideia nova)

Meta do João: conversar com estrangeiros em qualquer lugar, em ~6 meses, com 1h a 1h30 por dia
(30 a 40 min offline no metrô). Toda funcionalidade nova precisa servir a pelo menos um destes
métodos (pesquisa em `docs/PLANO.md`); se não servir, proponha um ajuste ou diga que não recomenda:

1. **Repetição espaçada** (FSRS): rever no momento certo, antes de esquecer.
2. **Prática de recuperação**: puxar da memória (digitar, falar, completar) vale mais que reconhecer.
3. **Input compreensível**: muito inglês um pouco acima do nível (histórias, cenas, áudio).
4. **Produção com correção**: falar e escrever, com feedback (chamada, diário, frases).
5. **Prática variada e intercalada**: formatos e assuntos misturados.

Regras da gamificação: recompensa só para ações que fazem aprender (esforço vale mais que clique);
errar nunca é punido; competir só consigo mesmo; nada de mecânica que incentive "passar de fase"
sem aprender (ex.: chutar alternativas). Na dúvida, prefira o que aumenta a recuperação ativa.
