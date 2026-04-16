import { hasStraight, parseCard, rankFrequency, sortCardsDescending, suitFrequency } from "./cards";
import type { BoardTexture, PlayerPosition, PostflopBucket, PreflopBucket } from "./types";

export function classifyPreflop(cards: string[]): PreflopBucket {
  const [a, b] = sortCardsDescending(cards);
  if (!a || !b) return "offsuit_trash";
  const pair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = Math.abs(a.value - b.value);
  const bothBroadway = a.value >= 10 && b.value >= 10;

  if (pair && a.value >= 12) return "premium_pair";
  if (pair && a.value >= 8) return "strong_pair";
  if (pair) return "small_pair";
  if (bothBroadway && suited && a.value >= 13) return "premium_broadway";
  if (bothBroadway) return "strong_broadway";
  if (suited && (a.rank === "A" || b.rank === "A")) return "suited_ace";
  if (suited && gap === 1 && a.value >= 6) return "suited_connector";
  if (suited && gap === 2) return "suited_gapper";
  if (!suited && bothBroadway) return "weak_offsuit_broadway";
  if (suited) return "weak_suited_trash";
  return "offsuit_trash";
}

export function classifyBoardTexture(board: string[]): BoardTexture {
  const cards = board.map(parseCard).filter((card): card is NonNullable<ReturnType<typeof parseCard>> => Boolean(card));
  const values = cards.map((card) => card.value);
  const suits = suitFrequency(board);
  const ranks = rankFrequency(board);
  const monotone = [...suits.values()].some((count) => count >= 3);
  const paired = [...ranks.values()].some((count) => count >= 2);
  const highCardHeavy = values.filter((value) => value >= 11).length >= 2;
  const lowConnected = values.length >= 3 && [...values].sort((a, b) => a - b).every((value, index, sorted) => index === 0 || value - sorted[index - 1] <= 2);
  const twoTone = [...suits.values()].some((count) => count === 2);
  const wetSignals = Number(monotone) + Number(lowConnected) + Number(hasStraight(values));
  const primary = wetSignals >= 2 || (lowConnected && twoTone) ? "wet" : wetSignals === 1 || paired ? "semi_wet" : "dry";
  const dynamic = primary !== "dry" || !highCardHeavy;
  return { primary, paired, monotone, highCardHeavy, lowConnected, dynamic };
}

function topBoardRank(board: string[]): number {
  const parsed = sortCardsDescending(board);
  return parsed[0]?.value ?? 0;
}

export function classifyPostflop(heroCards: string[], board: string[]): PostflopBucket {
  const allCards = [...heroCards, ...board];
  const rankCounts = [...rankFrequency(allCards).entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const suits = suitFrequency(allCards);
  const values = allCards
    .map(parseCard)
    .filter((card): card is NonNullable<ReturnType<typeof parseCard>> => Boolean(card))
    .map((card) => card.value);
  const heroValues = heroCards
    .map(parseCard)
    .filter((card): card is NonNullable<ReturnType<typeof parseCard>> => Boolean(card))
    .map((card) => card.value);
  const boardTop = topBoardRank(board);
  const topPair = heroValues.some((value) => value === boardTop);
  const overpair = heroValues.length === 2 && heroValues[0] === heroValues[1] && heroValues[0] > boardTop;
  const madeFlush = [...suits.values()].some((count) => count >= 5);
  const madeStraight = hasStraight(values);
  const hasTrips = rankCounts[0]?.[1] === 3;
  const hasTwoPair = rankCounts.filter(([, count]) => count >= 2).length >= 2;
  const flushDraw = [...suits.values()].some((count) => count === 4);
  const straightish = (() => {
    const uniq = [...new Set(values)].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i < uniq.length; i += 1) {
      if (uniq[i] <= uniq[i - 1] + 2) run += 1;
      else run = 1;
      if (run >= 4) return true;
    }
    return false;
  })();

  if (madeFlush && heroValues.includes(14)) return "near_nut_hand";
  if (madeFlush) return "flush";
  if (madeStraight) return "straight";
  if (hasTrips && heroValues.some((value) => rankCounts[0]?.[0] === value)) {
    if (heroValues[0] === heroValues[1]) return "set";
    return "strong_made_hand";
  }
  if (hasTwoPair) return "two_pair";
  if (overpair) return "overpair";
  if (topPair) {
    const kicker = heroValues.find((value) => value !== boardTop) ?? 0;
    return kicker >= 11 ? "top_pair_good_kicker" : "top_pair_weak_kicker";
  }
  if (flushDraw && straightish) return "combo_draw";
  if (flushDraw || straightish) return "draw";
  if (rankCounts[0]?.[1] === 2 || heroValues.some((value) => value >= 11)) return "weak_showdown";
  return "air";
}

export function isLatePosition(position: PlayerPosition): boolean {
  return position === "co" || position === "btn";
}
