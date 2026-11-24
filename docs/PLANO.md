# Plano do app

## Métodos de aprendizado (pesquisa e decisão)

| Método | Evidência | Onde entra |
|---|---|---|
| Repetição espaçada (SRS) | Forte, a mais bem sustentada para vocabulário | Motor do app: decide o que volta e quando |
| Prática de recuperação (active recall) | Forte | O formato de quiz; digitar fixa mais que escolher |
| Sistema Leitner | Base do SRS, simples | **Fase 1** (atual) |
| FSRS (algoritmo do Anki) | Prevê melhor que o SM-2 no benchmark do projeto | Fase 2 (`ts-fsrs`) |
| Input compreensível (Krashen) | Aceito, mas debatido; melhor junto com produção | Fase 3: frases e textos curtos |
| Lista de frequência | Consenso prático | Ordem dos pacotes |
| Shadowing | Pouca evidência formal; popular para pronúncia | Fase 4, opcional |
| Intercalação (interleaving) | Forte em outras áreas, pouco testada em idiomas | Mistura de tipos de pergunta na sessão |

## Como funciona hoje (Fase 1)

- Cada item fica numa caixa de 0 a 6. Acertou: sobe e volta depois de 1, 2, 4, 7, 15, 30 dias
  (contados a partir do início do dia). Errou: desce uma caixa e fica pendente na hora.
- O tipo de pergunta acompanha a caixa e se alterna dentro da sessão (intercalação):
  - caixas 0–1: inglês → português; a cada 3 perguntas, uma é só de ouvir;
  - caixas 2–3: português → inglês, completar a lacuna da frase, ouvir e falar no microfone;
  - caixas 4+: digitar em inglês, completar a lacuna e falar no microfone.
- Perguntas de ouvir/falar podem ser pausadas por 15 minutos ("Não posso ouvir/falar agora");
  nesse tempo viram perguntas de escolha. O áudio pausado também silencia a voz e os sons.
- Ao errar, o app explica: a resposta certa, o que significa a opção marcada e, para palavras
  que confundem (do/make, say/tell, much/many…), uma dica em `src/data/notes.ts`.
- Efeitos sonoros de acerto, erro e fim de sessão (sintetizados, sem arquivos).
- Histórico por dia (respostas, acertos, palavras novas) salvo junto com o progresso.
- Item novo: é apresentado (palavra, tradução, áudio, exemplo), perguntado 2 passos depois
  e repetido no fim da sessão, na direção inversa, para fixar.
- Errou na sessão: o item volta 3 passos depois (até 3 vezes), sem mexer de novo na caixa.
- Até 6 novos por sessão e 12 por dia. Até 20 revisões por sessão.
- Caixa 4+ (intervalo de 7+ dias) = "dominado". Com 80% do pacote dominado, o próximo libera.
- Digitação: ignora maiúsculas, acentos, pontuação e apóstrofo; 1 letra errada em palavras
  de 5+ letras conta como acerto, mostrando a grafia certa.
- Progresso salvo só no aparelho (localStorage). Sem backend e sem conta.

## Situações reais (conversas)

Além do quiz, há conversas em formato de chat (estilo WhatsApp) em `src/data/situations.ts`:
restaurante (liberado desde o início), cafeteria (20 palavras vistas), conhecer alguém (40),
pedir direções (70) e check-in no hotel (100). Cada turno pede um objetivo em português
("Peça a conta") e você responde escolhendo a frase, montando a frase com as palavras na ordem
certa, ou falando no microfone. Erros explicam armadilhas comuns de quem fala português
("account" × "check", "for travel" × "to go"). No fim: estrelas (3 sem erros) e a lista de
frases úteis com áudio. Concluir uma situação conta como dia de estudo.

## Versão 0.4 (as 10 ideias)

1. **Progresso**: números gerais, gráfico de minutos por dia (14 dias, com a meta) e medalhas.
2. **Backup**: código "MM1." para copiar/colar ou arquivo .json; restaurar pede confirmação.
3. **Caderno de erros**: palavras erradas nos últimos 14 dias; acertar no caderno tira de lá.
4. **FSRS** (biblioteca `ts-fsrs`, o algoritmo do Anki): decide quando cada palavra volta.
   Depois de acertar, dá para marcar Difícil / Bom / Fácil (mostra em quantos dias volta).
   A caixa 0–6 continua definindo o tipo de pergunta. Cartões antigos são migrados sozinhos.
5. **Pacotes**: Pacote 2 "Dia a dia" (libera com 80% do 1) e temáticos Viagem, Trabalho e
   Cinema e séries (liberam com 60 palavras vistas). "Focar" escolhe de onde vêm as novas.
6. **Situações**: 11 no total (+ aeroporto, farmácia, mercado, telefone, Uber, entrevista).
7. **Histórias**: 6 textos curtos com áudio frase a frase, tradução ao tocar e 3 perguntas.
8. **Ditado e shadowing**: ouvir e escrever / ouvir e repetir, conferindo palavra por palavra.
9. **Tempo de Miller**: relógio de estudo (soma o tempo entre toques nas atividades, ignorando
   pausas de mais de 90 s), meta diária, e a conversão do filme: 1 hora em Miller = 7 anos na
   Terra. Mostra quanto passou em Miller durante seu estudo e quanto passaria na Terra se você
   estudasse lá. 19 medalhas temáticas.
10. **Lembrete**: gera um evento diário (.ics) para a agenda do celular, com alarme e link.

## Notificações (v0.5)

Web Push sem servidor próprio: o app se inscreve com a chave pública VAPID e mostra o código de
inscrição; o João salva esse código e a chave privada como segredos do repositório; a tarefa
agendada `notify.yml` roda às 11h50 e 20h50 (Brasília) e envia a mensagem do turno com a
biblioteca `web-push` (só no GitHub Actions, não vai para o app). As mensagens mudam a cada dia
e não sabem do progresso (que fica só no celular). Para avisos personalizados ("12 revisões
esperando"), seria preciso app nativo ou sincronização na nuvem.

## Rumo à fluência em 6 meses (v0.7, etapa A)

Meta combinada: conversar com estrangeiros em qualquer lugar, com 1h a 1h30 por dia
(30 a 40 min offline no metrô). Etapa A, sem IA:
- **Avanço sem travas**: 20 palavras novas por dia (o antigo padrão 12 migra para 20), botão
  "Quero mais palavras (+6)" quando tudo está em dia, e o próximo pacote libera com 80% do
  anterior **visto** (não mais dominado: as revisões continuam pelo FSRS).
- **Missão do metrô**: 3 etapas offline (~35 min): sessão do dia, uma história, e ditado ou uma
  conversa (alternando por dia), com verificação de "pronto para ficar sem sinal" (app salvo,
  voz em inglês instalada). No Android, sem internet, perguntas de falar são trocadas por outras.
- **Cápsula do tempo (Mensagens de Cooper)**: uma mensagem de áudio por mês (até 3 min), mesma
  pergunta-base + um extra por mês, guardada no aparelho (IndexedDB); "antes e agora" a partir
  do 2º mês; vídeo opcional no mês 1 e no 6, salvo na galeria. Exportar para guardar cópia.

Etapa B1 (v0.8): servidor `worker/` na Cloudflare com Claude Haiku 5.5 (conversa com
pensamento desligado e esforço baixo, para ser rápida; relatório e correções com JSON validado
por schema). Chamada da Endurance (voz do celular + reconhecimento de voz, ou digitando),
relatório no fim (erros → Caderno de erros e "Minhas frases"; palavras novas → "Minhas frases"),
Diário e captura de frases com fila offline que sincroniza sozinha quando a internet volta.

Etapa B2 (próxima): conteúdo personalizado baixado antes, teste mensal de nível e análise dos
áudios da cápsula. Antes, na etapa B: Chamada da Endurance
(conversa por voz com Claude Haiku 5.5), fila offline (diário e frases capturadas no metrô são
corrigidos quando voltar a internet), conteúdo personalizado baixado antes, análise dos áudios
da cápsula e teste mensal de nível.

## Exercícios variados e alternativas inteligentes (v0.9)

Filtro de metodologia registrado no `CLAUDE.md`: toda ideia nova precisa servir a um dos cinco
métodos (repetição espaçada, recuperação, input compreensível, produção com correção, prática
intercalada).

- **Alternativas inteligentes** (`src/lib/choices.ts`, `src/data/topics.ts`): as erradas se
  parecem com a certa (mesmo tema, pares que confundem como do/make e say/tell, escrita parecida,
  mesma estrutura de frase). Palavra nova ganha uma alternativa mais tranquila; palavra firme, só
  parecidas. O que você já escolheu errado volta como alternativa (`progress.confusions`).
- **Escada de formatos** (`src/lib/modes.ts`), pela caixa do item:
  - reconhecer (0–1): significado, ouvir e escolher;
  - lembrar em contexto (2–3): escolher o inglês, completar a lacuna, ouvir, falar,
    **monte a frase** (blocos com duas palavras a mais) e **ache o erro** (palavra parecida
    trocada na frase);
  - produzir (4+): digitar, falar, **ouça e escreva**, **traduza a frase** (aceita 80% das
    palavras; "it's" e "it is" valem igual) e monte a frase.
  - Item sem o que o formato precisa (exemplo, lacuna) cai no básico da fase.
- **Pares relâmpago**: depois das palavras novas, uma rodada de ligar inglês ↔ português.
  Não mexe na revisão espaçada e errar só pisca o par.
- Ficaram para depois: "resposta natural" (escolher a resposta certa numa situação) e "frase livre
  com correção da IA".

## O jogo (v1.0)

Pedido do João: aprender jogando, sem parecer estudo e sem metas cobrando. Os exercícios
continuam os mesmos (o filtro de metodologia vale igual); muda a experiência em volta deles.

- **Viagem com tarefas** (`src/lib/voyage.ts`): cada sessão é um voo até um planeta, com uma
  lista de tarefas a bordo (consertar circuitos = monte a frase, sinal falso = ache o erro,
  transmissão com ruído = ouça e escreva, diário de bordo = traduza, alinhar motores = pares…).
  Completar todas leva ao pouso. Errar não falha a tarefa: a palavra só volta depois.
- **Voo na tela**: a nave anda na trajetória até o planeta, estrelas passam e aceleram no acerto,
  aviso quando um tipo de tarefa fica completo, sons de decolagem, tarefa e pouso.
- **Galáxia** (`src/screens/Galaxy.tsx`, `src/lib/galaxy.ts`): cada pacote é um planeta e cada
  palavra uma estrela. Revisão vencida = estrela apagando; "Reacender" viaja até lá. A repetição
  espaçada segue igual por baixo, sem contador de pendências cobrando.
- **Hangar** (`src/lib/hangar.ts`): naves, trajes e céus (cores do fundo) achados como surpresa,
  sempre por ações que fazem aprender. Só visual; sem loja nem moeda.
- **Diário da tripulação** (`src/data/crew.ts`): história contínua original em inglês básico
  (8 capítulos, com áudio, tradução e perguntas), liberada pelas viagens.
- **Menos placar**: a tela inicial não mostra mais meta diária, sequência nem % de acertos; o pouso
  não mostra nota. O app continua contando por trás (medalhas e gráfico).

## Próximas fases

1. **Fase 2 — FSRS**: trocar o Leitner pelo FSRS, com botões "difícil / bom / fácil".
2. **Fase 3 — contexto**: frases inteiras para montar (banco de palavras), pacote 2, tela de histórico.
3. **Fase 4 — uso**: ditado, shadowing e leituras curtas.
4. **Futuro**: geração de frases por IA (exige servidor e chave de API) e sincronização entre aparelhos.

## Como entra conteúdo novo

Os pacotes ficam em `src/data/`. Para criar o próximo: novo arquivo `packN.ts` no mesmo formato,
adicionado ao fim da lista em `src/data/packs.ts`. O texto em inglês forma o id do progresso:
corrigir a tradução é seguro, mudar o inglês reinicia o progresso daquele item.
