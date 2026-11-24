import type { Story } from './stories';

/**
 * Diário da tripulação: a história contínua do jogo (input compreensível).
 * Personagens e enredo originais. Aqui, `unlockAt` é o número de viagens feitas.
 * Você é o novo piloto da nave.
 */
const q = (question: string, right: string, wrong: [string, string], why: string) => ({
  q: question,
  options: [
    { text: right, ok: true },
    { text: wrong[0], ok: false },
    { text: wrong[1], ok: false },
  ],
  why,
});

export const crewChapters: Story[] = [
  {
    id: 'crew-1',
    title: 'The new pilot',
    emoji: '👩‍✈️',
    subtitle: 'Capítulo 1 · Você chega à nave',
    unlockAt: 0,
    sentences: [
      { en: 'Welcome to the ship, pilot!', pt: 'Bem-vindo à nave, piloto!' },
      { en: 'My name is Rosa. I am the captain.', pt: 'Meu nome é Rosa. Eu sou a capitã.' },
      { en: 'This is Kenji. He fixes the engines.', pt: 'Este é o Kenji. Ele conserta os motores.' },
      { en: 'This is Amara. She studies planets.', pt: 'Esta é a Amara. Ela estuda planetas.' },
      { en: 'And this little robot is Bip.', pt: 'E este robozinho é o Bip.' },
      { en: '"Hello! I like new friends!" says Bip.', pt: '"Olá! Eu gosto de amigos novos!" diz o Bip.' },
      { en: 'Rosa smiles. "We have a long trip. Are you ready?"', pt: 'A Rosa sorri. "Temos uma longa viagem. Você está pronto?"' },
    ],
    questions: [
      q('Quem é a capitã da nave?', 'Rosa', ['Amara', 'Bip'], '"My name is Rosa. I am the captain."'),
      q('O que o Kenji faz?', 'Conserta os motores', ['Estuda planetas', 'Pilota a nave'], '"He fixes the engines": fix = consertar.'),
      q('O que o Bip gosta?', 'De amigos novos', ['De motores', 'De dormir'], '"I like new friends!"'),
    ],
  },
  {
    id: 'crew-2',
    title: 'A strange signal',
    emoji: '📡',
    subtitle: 'Capítulo 2 · Uma voz no rádio',
    unlockAt: 2,
    sentences: [
      { en: 'It is night on the ship. Everybody is sleeping.', pt: 'É noite na nave. Todo mundo está dormindo.' },
      { en: 'But the radio makes a noise.', pt: 'Mas o rádio faz um barulho.' },
      { en: 'Bip listens. There is a voice.', pt: 'O Bip escuta. Tem uma voz.' },
      { en: 'The voice says only one word: "Hello?"', pt: 'A voz diz só uma palavra: "Olá?"' },
      { en: 'Bip runs to the captain. "Rosa! Wake up!"', pt: 'O Bip corre até a capitã. "Rosa! Acorda!"' },
      { en: 'Rosa listens too, but now the radio is quiet.', pt: 'A Rosa escuta também, mas agora o rádio está quieto.' },
      { en: '"Where is this signal from?" she asks.', pt: '"De onde vem esse sinal?" ela pergunta.' },
      { en: 'Nobody knows. Not yet.', pt: 'Ninguém sabe. Ainda não.' },
    ],
    questions: [
      q('Quando o rádio faz barulho?', 'À noite', ['De manhã', 'No almoço'], '"It is night on the ship."'),
      q('O que a voz diz?', '"Hello?"', ['"Help!"', '"Goodbye"'], '"The voice says only one word: Hello?"'),
      q('O que acontece quando a Rosa escuta?', 'O rádio já está quieto', ['A voz canta', 'O Bip dorme'], '"now the radio is quiet": quiet = quieto, em silêncio.'),
    ],
  },
  {
    id: 'crew-3',
    title: 'The broken engine',
    emoji: '🔧',
    subtitle: 'Capítulo 3 · Kenji precisa de ajuda',
    unlockAt: 4,
    sentences: [
      { en: 'Boom! The ship stops.', pt: 'Bum! A nave para.' },
      { en: '"The left engine is broken," says Kenji.', pt: '"O motor da esquerda está quebrado," diz o Kenji.' },
      { en: '"Pilot, can you help me? Give me the blue cable."', pt: '"Piloto, pode me ajudar? Me dá o cabo azul."' },
      { en: 'You give him the cable. He works for two hours.', pt: 'Você dá o cabo para ele. Ele trabalha por duas horas.' },
      { en: '"Thank you! It works again," he says.', pt: '"Obrigado! Funciona de novo," ele diz.' },
      { en: 'Then the radio speaks again: "Is anyone there?"', pt: 'Então o rádio fala de novo: "Tem alguém aí?"' },
      { en: 'This time, everybody hears it.', pt: 'Desta vez, todo mundo ouve.' },
    ],
    questions: [
      q('Qual motor quebrou?', 'O da esquerda', ['O da direita', 'Os dois'], '"The left engine is broken": left = esquerda.'),
      q('De que cor é o cabo?', 'Azul', ['Vermelho', 'Verde'], '"Give me the blue cable": blue = azul.'),
      q('O que a voz pergunta agora?', 'Se tem alguém lá', ['Onde está a nave', 'Que horas são'], '"Is anyone there?" = Tem alguém aí?'),
    ],
  },
  {
    id: 'crew-4',
    title: 'The ice planet',
    emoji: '🧊',
    subtitle: 'Capítulo 4 · Um mapa no gelo',
    unlockAt: 7,
    sentences: [
      { en: 'The ship lands on a small planet. It is very cold.', pt: 'A nave pousa num planeta pequeno. Está muito frio.' },
      { en: 'Amara is excited. "Look at this ice! It is beautiful."', pt: 'A Amara está animada. "Olha esse gelo! É lindo."' },
      { en: 'Under the ice, she finds an old box.', pt: 'Embaixo do gelo, ela encontra uma caixa velha.' },
      { en: 'Inside the box there is a map.', pt: 'Dentro da caixa tem um mapa.' },
      { en: 'The map shows a station near a red star.', pt: 'O mapa mostra uma estação perto de uma estrela vermelha.' },
      { en: '"The signal comes from there," says Rosa.', pt: '"O sinal vem de lá," diz a Rosa.' },
      { en: 'Bip is cold. "Can we go now, please?"', pt: 'O Bip está com frio. "Podemos ir agora, por favor?"' },
    ],
    questions: [
      q('Como é o planeta?', 'Pequeno e muito frio', ['Grande e quente', 'Cheio de água'], '"a small planet. It is very cold."'),
      q('O que tem dentro da caixa?', 'Um mapa', ['Um robô', 'Comida'], '"Inside the box there is a map."'),
      q('Onde fica a estação?', 'Perto de uma estrela vermelha', ['Embaixo do gelo', 'Na Terra'], '"a station near a red star": near = perto.'),
    ],
  },
  {
    id: 'crew-5',
    title: 'Bip learns a song',
    emoji: '🎵',
    subtitle: 'Capítulo 5 · Uma noite tranquila',
    unlockAt: 10,
    sentences: [
      { en: 'The trip is long, and Bip is bored.', pt: 'A viagem é longa, e o Bip está entediado.' },
      { en: '"Kenji, what do people do when they are bored?"', pt: '"Kenji, o que as pessoas fazem quando estão entediadas?"' },
      { en: '"Sometimes they sing," Kenji answers.', pt: '"Às vezes elas cantam," o Kenji responde.' },
      { en: 'Kenji teaches Bip an old song from Earth.', pt: 'O Kenji ensina ao Bip uma música antiga da Terra.' },
      { en: 'Bip sings very loud and very badly.', pt: 'O Bip canta muito alto e muito mal.' },
      { en: 'Everybody laughs. Even Rosa laughs.', pt: 'Todo mundo ri. Até a Rosa ri.' },
      { en: '"I am not bored now. I am happy!" says Bip.', pt: '"Não estou entediado agora. Estou feliz!" diz o Bip.' },
    ],
    questions: [
      q('Como o Bip está no começo?', 'Entediado', ['Com fome', 'Com medo'], '"Bip is bored": bored = entediado.'),
      q('O que o Kenji ensina?', 'Uma música antiga', ['A pilotar', 'A consertar motores'], '"Kenji teaches Bip an old song from Earth."'),
      q('Como o Bip canta?', 'Alto e mal', ['Baixo e bem', 'Em português'], '"very loud and very badly".'),
    ],
  },
  {
    id: 'crew-6',
    title: 'Closer',
    emoji: '🌟',
    subtitle: 'Capítulo 6 · O sinal fica mais forte',
    unlockAt: 14,
    sentences: [
      { en: 'Now the red star is near.', pt: 'Agora a estrela vermelha está perto.' },
      { en: 'The signal is stronger every day.', pt: 'O sinal fica mais forte a cada dia.' },
      { en: 'Today the voice says more words.', pt: 'Hoje a voz diz mais palavras.' },
      { en: '"I am alone. I am here for a long time. Please come."', pt: '"Estou sozinho. Estou aqui há muito tempo. Por favor, venham."' },
      { en: 'Amara is worried. "Is it dangerous?"', pt: 'A Amara está preocupada. "É perigoso?"' },
      { en: '"Maybe," says Rosa. "But someone needs help."', pt: '"Talvez," diz a Rosa. "Mas alguém precisa de ajuda."' },
      { en: 'She looks at you. "Pilot, take us there."', pt: 'Ela olha para você. "Piloto, leve a gente até lá."' },
    ],
    questions: [
      q('O que acontece com o sinal?', 'Fica mais forte', ['Some', 'Fica mais fraco'], '"The signal is stronger every day."'),
      q('Como a voz diz que está?', 'Sozinha', ['Doente', 'Com fome'], '"I am alone": alone = sozinho.'),
      q('Por que a Rosa decide ir?', 'Alguém precisa de ajuda', ['Ela quer o mapa', 'A nave quebrou'], '"But someone needs help."'),
    ],
  },
  {
    id: 'crew-7',
    title: 'The station',
    emoji: '🛰️',
    subtitle: 'Capítulo 7 · Quem chamava',
    unlockAt: 18,
    sentences: [
      { en: 'The station is old and dark.', pt: 'A estação é velha e escura.' },
      { en: 'You open the door slowly.', pt: 'Você abre a porta devagar.' },
      { en: 'Inside, there is a tall robot with green eyes.', pt: 'Lá dentro tem um robô alto com olhos verdes.' },
      { en: '"Hello. My name is Echo," says the robot.', pt: '"Olá. Meu nome é Echo," diz o robô.' },
      { en: '"I am here alone for one hundred years."', pt: '"Estou aqui sozinho há cem anos."' },
      { en: '"I learned English with old movies."', pt: '"Eu aprendi inglês com filmes antigos."' },
      { en: 'Bip walks to Echo. "Do you want to be my friend?"', pt: 'O Bip anda até o Echo. "Você quer ser meu amigo?"' },
      { en: 'Echo is quiet for a moment. Then he says, "Yes."', pt: 'O Echo fica quieto um momento. Então ele diz: "Sim."' },
    ],
    questions: [
      q('Como é o robô?', 'Alto, com olhos verdes', ['Pequeno, com olhos azuis', 'Velho e quebrado'], '"a tall robot with green eyes".'),
      q('Há quanto tempo o Echo está sozinho?', 'Cem anos', ['Dez anos', 'Um ano'], '"one hundred years" = cem anos.'),
      q('Como o Echo aprendeu inglês?', 'Com filmes antigos', ['Com livros', 'Com o Bip'], '"I learned English with old movies."'),
    ],
  },
  {
    id: 'crew-8',
    title: 'Everywhere',
    emoji: '🌍',
    subtitle: 'Capítulo 8 · Para onde agora?',
    unlockAt: 23,
    sentences: [
      { en: 'Echo comes to the ship. Now the crew has six friends.', pt: 'O Echo vem para a nave. Agora a tripulação tem seis amigos.' },
      { en: 'Kenji makes a big dinner. Amara makes a cake.', pt: 'O Kenji faz um jantar grande. A Amara faz um bolo.' },
      { en: 'Bip and Echo sing the old song together.', pt: 'O Bip e o Echo cantam juntos a música antiga.' },
      { en: 'This time, they sing well.', pt: 'Desta vez, eles cantam bem.' },
      { en: '"So, captain, where do we go now?" asks Amara.', pt: '"E aí, capitã, para onde vamos agora?" pergunta a Amara.' },
      { en: 'Rosa looks at the stars. Then she looks at you.', pt: 'A Rosa olha para as estrelas. Depois olha para você.' },
      { en: '"Pilot, you choose."', pt: '"Piloto, você escolhe."' },
      { en: 'You smile and say: "Everywhere."', pt: 'Você sorri e diz: "Para todo lugar."' },
    ],
    questions: [
      q('Quantos amigos tem a tripulação agora?', 'Seis', ['Cinco', 'Quatro'], '"Now the crew has six friends": six = seis.'),
      q('O que a Amara faz?', 'Um bolo', ['O jantar', 'Uma música'], '"Amara makes a cake."'),
      q('Quem escolhe o próximo destino?', 'Você, o piloto', ['A Rosa', 'O Echo'], '"Pilot, you choose."'),
    ],
  },
];

/** Capítulos liberados conforme as viagens feitas. */
export function crewOpen(trips: number): Story[] {
  return crewChapters.filter((c) => trips >= c.unlockAt);
}
