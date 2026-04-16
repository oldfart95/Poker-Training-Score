import { ARCHETYPES } from "./constants";
import { normalizeNumber, normalizeString } from "./utils";
import type { Action, ActionType, Archetype, Hand, RawAction, RawHand, RawSeat, RawSession, Seat, Session, Street } from "./types";

function normalizeStreet(input: string | undefined): Street {
  const value = (input ?? "").toLowerCase();
  if (value === "flop" || value === "turn" || value === "river" || value === "showdown") return value;
  return "preflop";
}

function normalizeActionType(input: string | undefined): ActionType {
  const value = (input ?? "").toLowerCase();
  switch (value) {
    case "fold":
    case "check":
    case "call":
    case "bet":
    case "raise":
    case "all_in":
    case "post_blind":
    case "ante":
      return value;
    default:
      return "call";
  }
}

function normalizePosition(input: string | undefined): Seat["position"] {
  const value = (input ?? "").toLowerCase();
  switch (value) {
    case "utg":
    case "hj":
    case "co":
    case "btn":
    case "sb":
    case "bb":
      return value;
    default:
      return "unknown";
  }
}

function normalizeArchetype(input: string | undefined): Archetype {
  const direct = input?.trim();
  if (direct && direct in ARCHETYPES) return direct as Archetype;
  const lowered = direct?.toLowerCase() ?? "";
  if (lowered.includes("station")) return "Calling Station";
  if (lowered.includes("maniac")) return "Maniac";
  if (lowered.includes("lag")) return "LAG";
  if (lowered.includes("tag")) return "TAG";
  if (lowered.includes("nit")) return "Nit";
  return "Unknown";
}

function fallbackId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

function parseSeat(rawSeat: RawSeat, sessionHeroSeatId: string | null, index: number): Seat {
  const id = normalizeString(rawSeat.id ?? rawSeat.playerId, fallbackId("seat", index));
  const isHero = Boolean(rawSeat.hero ?? rawSeat.isHero) || (sessionHeroSeatId !== null && id === sessionHeroSeatId);
  return {
    id,
    name: normalizeString(rawSeat.name ?? rawSeat.label, isHero ? "Hero" : id),
    position: normalizePosition(typeof rawSeat.position === "string" ? rawSeat.position : undefined),
    archetype: normalizeArchetype(typeof rawSeat.archetype === "string" ? rawSeat.archetype : undefined),
    stack: typeof rawSeat.stack === "number" ? rawSeat.stack : null,
    isHero,
  };
}

function parseAction(rawAction: RawAction, heroSeatId: string | null): Action {
  const actorId = normalizeString(rawAction.actorId ?? rawAction.seatId ?? rawAction.playerId, "unknown");
  return {
    actorId,
    street: normalizeStreet(rawAction.street),
    type: normalizeActionType(rawAction.type),
    amount: normalizeNumber(rawAction.amount, 0),
    toAmount: typeof rawAction.toAmount === "number" ? rawAction.toAmount : null,
    pot: typeof rawAction.pot === "number" ? rawAction.pot : null,
    board: Array.isArray(rawAction.board) ? rawAction.board.filter((value): value is string => typeof value === "string") : [],
    note: typeof rawAction.note === "string" ? rawAction.note : null,
    isHero: Boolean(rawAction.isHero) || (heroSeatId !== null && actorId === heroSeatId),
  };
}

function parseHand(rawHand: RawHand, sessionHeroSeatId: string | null, fallbackNumber: number): Hand {
  const derivedHeroSeatId = normalizeString(rawHand.summary?.heroSeatId ?? rawHand.results?.heroSeatId ?? sessionHeroSeatId, sessionHeroSeatId ?? "");
  const seats = Array.isArray(rawHand.seats) ? rawHand.seats.map((seat, index) => parseSeat(seat, derivedHeroSeatId || null, index + 1)) : [];
  const heroSeat = seats.find((seat) => seat.isHero) ?? null;
  const normalizedHeroSeatId = heroSeat?.id ?? derivedHeroSeatId ?? null;
  const actions = Array.isArray(rawHand.actions) ? rawHand.actions.map((action) => parseAction(action, normalizedHeroSeatId)) : [];

  return {
    id: normalizeString(rawHand.id, `hand-${fallbackNumber}`),
    handNumber: typeof rawHand.handNumber === "number" ? rawHand.handNumber : fallbackNumber,
    heroSeatId: normalizedHeroSeatId,
    buttonSeatId: typeof rawHand.buttonSeatId === "string" ? rawHand.buttonSeatId : null,
    seats,
    heroSeat,
    heroHoleCards:
      (Array.isArray(rawHand.heroHoleCards) ? rawHand.heroHoleCards : Array.isArray(rawHand.holeCards) ? rawHand.holeCards : []).filter(
        (card): card is string => typeof card === "string",
      ),
    actions,
    board: Array.isArray(rawHand.board) ? rawHand.board.filter((card): card is string => typeof card === "string") : [],
    results: rawHand.results && typeof rawHand.results === "object" ? rawHand.results : {},
    stacks: rawHand.stacks && typeof rawHand.stacks === "object" ? (rawHand.stacks as Record<string, number>) : {},
    summary: rawHand.summary && typeof rawHand.summary === "object" ? rawHand.summary : {},
  };
}

export interface ParseResult {
  session: Session;
  warnings: string[];
}

export function parseSession(rawSession: RawSession): ParseResult {
  const warnings: string[] = [];
  const heroSeatId = typeof rawSession.heroSeatId === "string" ? rawSession.heroSeatId : typeof rawSession.heroId === "string" ? rawSession.heroId : null;
  const hands = Array.isArray(rawSession.hands)
    ? rawSession.hands.map((hand, index) => parseHand(hand, heroSeatId, index + 1))
    : [];

  if (!hands.length) warnings.push("No hands found in session export.");
  if (!heroSeatId && !hands.some((hand) => hand.heroSeat)) warnings.push("Hero seat was missing; analyzer used best-effort hero markers.");

  return {
    session: {
      id: normalizeString(rawSession.id ?? rawSession.sessionId, "session-import"),
      createdAt: typeof rawSession.createdAt === "string" ? rawSession.createdAt : null,
      roomPolicy: normalizeString(rawSession.roomPolicy, "Pocket Pixel Poker"),
      sourceMode: typeof rawSession.mode === "string" ? rawSession.mode : typeof rawSession.philosophy === "string" ? rawSession.philosophy : null,
      heroSeatId,
      stakes: typeof rawSession.stakes === "string" ? rawSession.stakes : null,
      hands,
      summaryStats: rawSession.summaryStats && typeof rawSession.summaryStats === "object" ? rawSession.summaryStats : {},
    },
    warnings,
  };
}
