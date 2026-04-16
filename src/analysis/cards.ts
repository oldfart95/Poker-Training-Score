const RANKS = "23456789TJQKA";

export interface ParsedCard {
  rank: string;
  suit: string;
  value: number;
}

export function parseCard(card: string | null | undefined): ParsedCard | null {
  if (!card || card.length < 2) return null;
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  const value = RANKS.indexOf(rank) + 2;
  if (value < 2 || !"cdhs".includes(suit)) return null;
  return { rank, suit, value };
}

export function sortCardsDescending(cards: string[]): ParsedCard[] {
  return cards
    .map(parseCard)
    .filter((card): card is ParsedCard => Boolean(card))
    .sort((a, b) => b.value - a.value);
}

export function rankFrequency(cards: string[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const parsed = parseCard(card);
    if (!parsed) continue;
    counts.set(parsed.value, (counts.get(parsed.value) ?? 0) + 1);
  }
  return counts;
}

export function suitFrequency(cards: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const parsed = parseCard(card);
    if (!parsed) continue;
    counts.set(parsed.suit, (counts.get(parsed.suit) ?? 0) + 1);
  }
  return counts;
}

export function hasStraight(values: number[]): boolean {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.includes(14)) uniq.unshift(1);
  let run = 1;
  for (let i = 1; i < uniq.length; i += 1) {
    if (uniq[i] === uniq[i - 1] + 1) {
      run += 1;
      if (run >= 5) return true;
    } else {
      run = 1;
    }
  }
  return false;
}
