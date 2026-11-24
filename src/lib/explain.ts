import type { Item, PartOfSpeech } from '../data/types';
import { answerField, type Mode } from './modes';

const POS_LABEL: Record<PartOfSpeech, string> = {
  pronome: 'pronome',
  determinante: 'palavra de quantidade',
  preposição: 'preposição',
  conjunção: 'conectivo',
  verbo: 'verbo',
  substantivo: 'substantivo',
  adjetivo: 'adjetivo',
  advérbio: 'advérbio',
  número: 'número',
  frase: 'frase pronta',
};

export interface ExplainInput {
  item: Item;
  mode: Mode;
  /** O que a pessoa escolheu, digitou ou falou (null se pulou / "não sei"). */
  chosen: string | null;
  /** "Ache o erro": a palavra que foi trocada na frase. */
  swapped?: string;
  pool: readonly Item[];
  notes: Readonly<Record<string, string>>;
}

/** Monta a explicação do erro: qual era a resposta certa e por quê. */
export function explain({ item, mode, chosen, pool, notes, swapped }: ExplainInput): string[] {
  const lines: string[] = [];
  const field = answerField(mode);
  const pos = POS_LABEL[item.pos];
  const tipFor = (en: string) => notes[en.toLowerCase()];

  // Formatos de frase inteira: mostra a frase certa e o que ela quer dizer.
  if (mode === 'build' || mode === 'translate') {
    const sentence = mode === 'build' && item.pos === 'frase' && !item.ex ? { en: item.en, pt: item.pt } : { en: item.ex ?? item.en, pt: item.exPt ?? item.pt };
    lines.push(`A frase é "${sentence.en}" (${sentence.pt}).`);
    if (chosen) lines.push(mode === 'build' ? `Você montou "${chosen}".` : `Você escreveu "${chosen}".`);
    lines.push(`Repare em "${item.en}", que significa "${item.pt}".`);
    const tip = tipFor(item.en);
    if (tip) lines.push(tip);
    return lines;
  }
  if (mode === 'spot-error') {
    if (swapped) lines.push(`A palavra trocada era "${swapped}": o certo é "${item.en}" (${item.pt}).`);
    if (chosen && swapped && chosen !== swapped) lines.push(`"${chosen}" estava certa na frase.`);
    const other = swapped ? pool.find((i) => i.en.toLowerCase() === swapped.toLowerCase()) : undefined;
    if (other) lines.push(`"${other.en}" significa "${other.pt}".`);
    const tip = tipFor(item.en) ?? (other ? tipFor(other.en) : undefined);
    if (tip) lines.push(tip);
    return lines;
  }

  if (field === 'pt') {
    lines.push(
      mode === 'listen-choice'
        ? `No áudio foi dito "${item.en}" (${pos}), que significa "${item.pt}".`
        : `"${item.en}" (${pos}) significa "${item.pt}".`,
    );
  } else if (mode === 'listen-type') {
    lines.push(`No áudio foi dito "${item.en}" (${pos}), que significa "${item.pt}".`);
  } else {
    lines.push(`"${item.pt}" em inglês é "${item.en}" (${pos}).`);
  }

  let other: Item | undefined;
  if (chosen) {
    if (mode === 'pt-en-type' || mode === 'speak' || mode === 'listen-type') {
      const typed = chosen.trim().toLowerCase();
      other = pool.find((i) => i.id !== item.id && i.en.toLowerCase() === typed);
      const verb = mode === 'speak' ? 'O microfone entendeu' : 'Você escreveu';
      lines.push(other ? `${verb} "${chosen}", que significa "${other.pt}".` : `${verb} "${chosen}".`);
    } else {
      other = pool.find((i) => i.id !== item.id && i[field] === chosen);
      if (other) {
        lines.push(
          field === 'pt'
            ? `Você marcou "${chosen}", que é a tradução de "${other.en}".`
            : `"${chosen}" significa "${other.pt}", não "${item.pt}".`,
        );
      }
    }
  }

  if (mode === 'cloze-choice' && item.exPt) {
    lines.push(`A frase quer dizer "${item.exPt}", por isso a palavra que falta é "${item.en}".`);
  }

  const tip = notes[item.en.toLowerCase()] ?? (other ? notes[other.en.toLowerCase()] : undefined);
  if (tip) lines.push(tip);

  return lines;
}
