export type PartOfSpeech =
  | 'pronome'
  | 'determinante'
  | 'preposição'
  | 'conjunção'
  | 'verbo'
  | 'substantivo'
  | 'adjetivo'
  | 'advérbio'
  | 'número'
  | 'frase';

export interface Item {
  /** Identificador estável: nunca mudar depois de publicado, senão o progresso se perde. */
  id: string;
  en: string;
  pt: string;
  pos: PartOfSpeech;
  /** Frase de exemplo em inglês (opcional para frases prontas). */
  ex?: string;
  exPt?: string;
}

export interface Pack {
  id: string;
  title: string;
  subtitle: string;
  /** core: sequência principal (libera com 80% do anterior); theme: temático (libera com palavras vistas). */
  /** mine: frases suas, criadas a partir das conversas, do diário e das frases capturadas. */
  kind: 'core' | 'theme' | 'mine';
  items: Item[];
}

/** Linha compacta usada nos arquivos de conteúdo: [en, pt, classe, exemplo?, tradução do exemplo?] */
export type Row = readonly [string, string, PartOfSpeech, string?, string?];

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function rowsToItems(packId: string, rows: readonly Row[]): Item[] {
  return rows.map(([en, pt, pos, ex, exPt]) => {
    const item: Item = { id: `${packId}:${slug(en)}`, en, pt, pos };
    if (ex) item.ex = ex;
    if (exPt) item.exPt = exPt;
    return item;
  });
}
