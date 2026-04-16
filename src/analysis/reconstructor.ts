import { ARCHETYPES } from "./constants";
import { classifyBoardTexture, classifyPostflop, classifyPreflop, isLatePosition } from "./classification";
import { average, sum } from "./utils";
import type { Action, Hand, HandContext, Seat } from "./types";

function getVillains(hand: Hand): Seat[] {
  return hand.seats.filter((seat) => !seat.isHero);
}

function lineSummary(actions: Action[]): string {
  if (!actions.length) return "No action data available.";
  const heroActions = actions.filter((action) => action.isHero);
  const parts = heroActions.slice(0, 5).map((action) => `${action.street} ${action.type}${action.amount ? ` ${action.amount}` : ""}`);
  return parts.length ? parts.join(" -> ") : "Hero had no logged decision points.";
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
  const potSizeEstimate =
    hand.actions.map((action) => action.pot).filter((pot): pot is number => typeof pot === "number").at(-1) ??
    sum(hand.actions.map((action) => action.amount));
  const villainAggressionFaced = villainActions.filter((action) => ["bet", "raise", "all_in"].includes(action.type)).length;
  const effectiveStackCandidates = hand.seats.map((seat) => seat.stack).filter((stack): stack is number => typeof stack === "number");
  const effectiveStack = effectiveStackCandidates.length ? Math.min(...effectiveStackCandidates) : null;
  const heroWentToShowdown = hand.actions.some((action) => action.street === "showdown") || Boolean(hand.results.showdown);
  const heroWon = typeof hand.results.heroWon === "boolean" ? hand.results.heroWon : typeof hand.summary.heroWon === "boolean" ? (hand.summary.heroWon as boolean) : null;
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
    lineSummary: lineSummary(hand.actions),
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
