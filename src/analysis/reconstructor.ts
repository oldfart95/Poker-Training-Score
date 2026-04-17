import { ARCHETYPES } from "./constants";
import { classifyBoardTexture, classifyPostflop, classifyPreflop, isLatePosition } from "./classification";
import { average, sum } from "./utils";
import type { Action, Hand, HandContext, Seat } from "./types";

function getVillains(hand: Hand): Seat[] {
  return hand.seats.filter((seat) => !seat.isHero);
}

function actionChain(actions: Action[]): string {
  if (!actions.length) return "No action data available.";
  return actions
    .map((action) => `${action.street}:${action.actorId}:${action.type}${action.amount ? `(${action.amount})` : ""}`)
    .join(" -> ");
}

function lineSummary(actions: Action[]): string {
  if (!actions.length) return "No action data available.";
  const heroActions = actions.filter((action) => action.isHero);
  const parts = heroActions.slice(0, 6).map((action) => `${action.street} ${action.type}${action.amount ? ` ${action.amount}` : ""}`);
  return parts.length ? parts.join(" -> ") : "Hero had no logged decision points.";
}

function inferPreflopAggressor(actions: Action[]): string | null {
  return actions.find((action) => action.street === "preflop" && ["bet", "raise", "all_in"].includes(action.type))?.actorId ?? null;
}

function inferFacingBet(actions: Action[], heroSeatId: string | null): number {
  if (!heroSeatId) return 0;
  let currentBet = 0;
  const contributed = new Map<string, number>();

  for (const action of actions) {
    if (action.street !== "preflop") break;
    const currentContribution = contributed.get(action.actorId) ?? 0;
    if (["bet", "raise", "all_in"].includes(action.type)) {
      currentBet = Math.max(currentBet, currentContribution + action.amount);
    }
    if (action.actorId === heroSeatId && ["call", "raise", "all_in", "fold", "check"].includes(action.type)) {
      return Math.max(0, currentBet - currentContribution);
    }
    contributed.set(action.actorId, currentContribution + action.amount);
  }
  return 0;
}

function inferResult(hand: Hand): string {
  const payouts = hand.results.payouts;
  if (payouts && typeof payouts === "object" && hand.heroSeatId) {
    const value = (payouts as Record<string, unknown>)[hand.heroSeatId];
    if (typeof value === "number") return value >= 0 ? `Hero won ${value}.` : `Hero lost ${Math.abs(value)}.`;
  }
  if (typeof hand.results.heroWon === "boolean") return hand.results.heroWon ? "Hero won the hand." : "Hero lost the hand.";
  return "Result unavailable.";
}

export function reconstructHand(hand: Hand): HandContext {
  const villains = getVillains(hand);
  const heroPosition = hand.heroSeat?.position ?? "unknown";
  const heroPreflopBucket = classifyPreflop(hand.heroHoleCards);
  const finalBoard = hand.board.length ? hand.board : [...new Set(hand.actions.flatMap((action) => action.board))];
  const boardTexture = classifyBoardTexture(finalBoard.slice(0, 3));
  const postflopBucket = classifyPostflop(hand.heroHoleCards, finalBoard);
  const heroActions = hand.actions.filter((action) => action.isHero);
  const villainActions = hand.actions.filter((action) => !action.isHero);
  const heroAggressiveActions = heroActions.filter((action) => ["bet", "raise", "all_in"].includes(action.type)).length;
  const heroPassiveActions = heroActions.filter((action) => ["check", "call"].includes(action.type)).length;
  const heroInvested = sum(heroActions.map((action) => action.amount));
  const potSizeEstimate = sum(hand.actions.map((action) => action.amount));
  const villainAggressionFaced = villainActions.filter((action) => ["bet", "raise", "all_in"].includes(action.type)).length;
  const effectiveStackCandidates = hand.seats.map((seat) => hand.stacks[seat.id] ?? seat.stack).filter((stack): stack is number => typeof stack === "number");
  const effectiveStack = effectiveStackCandidates.length ? Math.min(...effectiveStackCandidates) : null;
  const heroWentToShowdown = Boolean(hand.results.showdown) || hand.actions.some((action) => action.street === "showdown");
  const heroWon = typeof hand.results.heroWon === "boolean" ? hand.results.heroWon : null;
  const targetedVillainArchetypes = villains.map((seat) => ARCHETYPES[seat.archetype]);
  const dominantVillainArchetype =
    targetedVillainArchetypes.sort((a, b) => b.callTendency + b.aggressionTendency - (a.callTendency + a.aggressionTendency))[0] ?? ARCHETYPES.Unknown;
  const preflopHero = heroActions.filter((action) => action.street === "preflop");
  const openedPreflop = preflopHero.some((action) => ["bet", "raise"].includes(action.type));
  const coldCalledPreflop = preflopHero.some((action) => action.type === "call");
  const threeBet = preflopHero.filter((action) => action.type === "raise").length >= 2;
  const isolatedLimpers = openedPreflop && villains.some((seat) => seat.archetype === "Calling Station" || seat.archetype === "Nit");
  const postflopHeroAggroStreets = new Set(
    heroActions.filter((action) => action.street !== "preflop" && ["bet", "raise", "all_in"].includes(action.type)).map((action) => action.street),
  );
  const facedStickyTarget = targetedVillainArchetypes.some((profile) => profile.callTendency >= 0.7);
  const facedOverfolder = targetedVillainArchetypes.some((profile) => profile.foldTendency >= 0.7);
  const facingBet = inferFacingBet(hand.actions, hand.heroSeatId);
  const potOdds = facingBet > 0 ? facingBet / (potSizeEstimate + facingBet) : null;
  const spr = effectiveStack !== null && potSizeEstimate > 0 ? effectiveStack / potSizeEstimate : null;

  return {
    hand,
    villains,
    heroPosition,
    heroPreflopBucket,
    finalBoard,
    boardTexture,
    postflopBucket,
    potSizeEstimate,
    heroInvested,
    heroAggressiveActions,
    heroPassiveActions,
    villainAggressionFaced,
    effectiveStack,
    heroWentToShowdown,
    heroWon,
    dominantVillainArchetype,
    targetedVillainArchetypes,
    playerCount: hand.seats.filter((seat) => !seat.inactive && !seat.busted).length,
    stackDepthBb: effectiveStack,
    preflopAggressor: inferPreflopAggressor(hand.actions),
    facingBet,
    potOdds,
    spr,
    streetState: `${finalBoard.length ? `${finalBoard.length}-card board` : "no board"} / ${villains.length} villain(s)`,
    lineSummary: lineSummary(hand.actions),
    actionChain: actionChain(hand.actions),
    resultLabel: inferResult(hand),
    flags: {
      openedPreflop,
      coldCalledPreflop,
      threeBet,
      isolatedLimpers,
      barreledMultipleStreets: postflopHeroAggroStreets.size >= 2,
      shoved: heroActions.some((action) => action.type === "all_in"),
      facedStickyTarget,
      facedOverfolder,
      actedInPositionMostPostflop: isLatePosition(heroPosition) || average(villains.map((villain) => (villain.position === "sb" || villain.position === "bb" ? 1 : 0))) > 0.5,
    },
  };
}
