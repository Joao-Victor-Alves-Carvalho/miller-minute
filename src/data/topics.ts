/**
 * Grupos de tema e pares que confundem: usados para montar alternativas erradas que exigem
 * lembrar de verdade (e não dá para eliminar pelo bom senso). Palavras em minúsculas, como no
 * texto em inglês dos itens.
 */
export const TOPICS: Record<string, string[]> = {
  familia: ['mother', 'father', 'brother', 'sister', 'son', 'daughter', 'husband', 'wife', 'baby', 'child', 'boy', 'girl', 'man', 'woman', 'people', 'friend', 'family', 'grandmother', 'grandfather', 'uncle', 'aunt', 'cousin', 'parents', 'neighbor'],
  tempo: ['today', 'tomorrow', 'yesterday', 'now', 'later', 'soon', 'early', 'late', 'morning', 'afternoon', 'night', 'tonight', 'day', 'week', 'month', 'year', 'hour', 'minute', 'weekend', 'noon', 'midnight', 'time', 'ago'],
  frequencia: ['always', 'never', 'sometimes', 'often', 'usually', 'again', 'already', 'still', 'finally', 'just', 'almost'],
  dias: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  numeros: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'forty', 'fifty', 'hundred', 'thousand', 'million'],
  cores: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'brown', 'orange', 'color'],
  comida: ['food', 'water', 'coffee', 'bread', 'breakfast', 'lunch', 'dinner', 'meat', 'chicken', 'fish', 'rice', 'beans', 'egg', 'milk', 'cheese', 'fruit', 'apple', 'juice', 'beer', 'wine', 'sugar', 'salt'],
  mesa: ['cup', 'glass', 'plate', 'fork', 'knife', 'spoon', 'table', 'chair'],
  casa: ['home', 'house', 'room', 'kitchen', 'bathroom', 'door', 'window', 'floor', 'wall', 'stairs', 'garden', 'key', 'bed'],
  cidade: ['city', 'country', 'street', 'store', 'school', 'office', 'bank', 'park', 'church', 'beach', 'river', 'mountain', 'bridge', 'station', 'airport', 'museum', 'library', 'market', 'police'],
  transporte: ['car', 'bus', 'train', 'plane', 'bike', 'boat', 'ticket', 'map', 'trip', 'subway'],
  corpo: ['head', 'eye', 'hand', 'heart', 'body', 'arm', 'leg', 'foot', 'mouth', 'nose', 'ear', 'hair', 'tooth', 'back'],
  roupas: ['clothes', 'shirt', 'pants', 'dress', 'shoes', 'jacket', 'hat', 'bag'],
  sentimentos: ['happy', 'sad', 'tired', 'hungry', 'angry', 'afraid', 'excited', 'bored', 'sick', 'healthy', 'busy', 'ready', 'sure', 'lucky'],
  qualidades: ['big', 'small', 'long', 'short', 'tall', 'good', 'bad', 'better', 'best', 'great', 'new', 'old', 'young', 'easy', 'hard', 'hot', 'cold', 'warm', 'cool', 'fast', 'slow', 'cheap', 'expensive', 'full', 'empty', 'heavy', 'light', 'soft', 'loud', 'quiet', 'dark', 'beautiful', 'ugly', 'nice', 'funny', 'boring', 'interesting'],
  perguntas: ['what', 'who', 'where', 'when', 'why', 'how', 'which', 'how many'],
  movimento: ['go', 'come', 'walk', 'run', 'drive', 'fly', 'swim', 'ride', 'travel', 'arrive', 'leave', 'return', 'move', 'climb', 'jump', 'cross'],
  sentidos: ['see', 'look', 'watch', 'hear', 'listen', 'feel', 'touch'],
  comunicacao: ['say', 'tell', 'speak', 'talk', 'ask', 'answer', 'call', 'explain', 'agree', 'invite'],
  trocas: ['give', 'take', 'bring', 'send', 'buy', 'sell', 'pay', 'borrow', 'lend', 'carry', 'cost', 'save', 'spend', 'share', 'order'],
  mente: ['know', 'think', 'believe', 'remember', 'forget', 'understand', 'learn', 'study', 'mean', 'seem', 'hope', 'decide', 'prefer', 'worry', 'plan'],
  cumprimentos: ['hello', 'good morning', 'good night', 'goodbye', 'see you later', 'good afternoon', 'good evening', 'see you tomorrow', 'welcome', 'take care', 'have a nice day', "what's up?"],
  cortesia: ['thank you', 'please', "you're welcome", 'excuse me', "i'm sorry", 'no problem', 'of course', 'never mind', "don't worry"],
  lugar: ['in', 'on', 'at', 'under', 'between', 'near', 'behind', 'here', 'there', 'inside', 'outside', 'up', 'down'],
};

/** Pares que brasileiros costumam confundir (falsos amigos, opostos e quase-sinônimos). */
export const CONFUSABLE: [string, string][] = [
  ['do', 'make'], ['say', 'tell'], ['speak', 'talk'], ['hear', 'listen'], ['see', 'look'], ['look', 'watch'], ['see', 'watch'],
  ['much', 'many'], ['very', 'too'], ['also', 'too'], ['know', 'meet'], ['find', 'meet'], ['leave', 'let'], ['take', 'bring'],
  ['in', 'on'], ['on', 'at'], ['in', 'at'], ['of', 'from'], ['home', 'house'], ['his', 'her'], ['this', 'that'], ['these', 'those'],
  ['what', 'which'], ['time', 'weather'], ['lend', 'borrow'], ['lose', 'miss'], ['remember', 'forget'], ['buy', 'sell'],
  ['open', 'close'], ['come', 'go'], ['start', 'finish'], ['ask', 'answer'], ['before', 'after'], ['near', 'far'], ['here', 'there'],
  ['up', 'down'], ['early', 'late'], ['cheap', 'expensive'], ['hot', 'cold'], ['big', 'small'], ['easy', 'hard'], ['inside', 'outside'],
  ['always', 'never'], ['tomorrow', 'yesterday'], ['bored', 'boring'], ['lunch', 'dinner'], ['breakfast', 'lunch'], ['good', 'well'],
  ['win', 'lose'], ['give', 'take'], ['learn', 'teach'], ['wear', 'use'], ['spend', 'save'], ['still', 'already'], ['then', 'so'],
  ['every', 'each'], ['other', 'another'], ['better', 'best'], ['tall', 'long'], ['far', 'long'], ['good night', 'good evening'],
  ['excuse me', "i'm sorry"], ['thank you', "you're welcome"], ['how are you?', 'how old are you?'], ['how many', 'how'],
];

const topicOf = new Map<string, string[]>();
for (const [topic, words] of Object.entries(TOPICS)) {
  for (const w of words) topicOf.set(w, [...(topicOf.get(w) ?? []), topic]);
}

const confusableOf = new Map<string, Set<string>>();
for (const [a, b] of CONFUSABLE) {
  if (!confusableOf.has(a)) confusableOf.set(a, new Set());
  if (!confusableOf.has(b)) confusableOf.set(b, new Set());
  confusableOf.get(a)!.add(b);
  confusableOf.get(b)!.add(a);
}

export function topicsFor(en: string): string[] {
  return topicOf.get(en.toLowerCase()) ?? [];
}

export function areConfusable(a: string, b: string): boolean {
  return confusableOf.get(a.toLowerCase())?.has(b.toLowerCase()) ?? false;
}
