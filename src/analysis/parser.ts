import { ARCHETYPES } from "./constants";
import { normalizeNumber, normalizeString } from "./utils";
import { validateSession } from "./validator";
import type {
  Action,
  ActionType,
  Archetype,
  Hand,
  ParseResult,
  RawAction,
  RawHand,
  RawSeat,
  RawSession,
  Seat,
  Session,
  Street,
} from "./types";

function normalizeStreet(input: string | undefined): Street {
  const value = (input ?? "").toLowerCase();
  if (value === "flop" || value === "turn" || value === "river" || value === "showdown") return value;
  return "preflop";
}

function normalizeActionType(input: string | undefined): { type: ActionType; unknown: string | null } {
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
      return { type: value, unknown: null };
    default:
      return { type: "call", unknown: input ?? null };
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
    busted: Boolean(rawSeat.busted) || (typeof rawSeat.stack === "number" && rawSeat.stack <= 0),
    inactive: Boolean(rawSeat.inactive),
  };
}

function parseAction(rawAction: RawAction, heroSeatId: string | null): Action {
  const actorId = normalizeString(rawAction.actorId ?? rawAction.seatId ?? rawAction.playerId, "unknown");
  const normalizedType = normalizeActionType(rawAction.type);
  const rawNote = typeof rawAction.note === "string" ? rawAction.note : null;
  return {
    actorId,
    street: normalizeStreet(rawAction.street),
    type: normalizedType.type,
    amount: normalizeNumber(rawAction.amount, 0),
    toAmount: typeof rawAction.toAmount === "number" ? rawAction.toAmount : null,
    pot: typeof rawAction.pot === "number" ? rawAction.pot : null,
    board: Array.isArray(rawAction.board) ? rawAction.board.filter((value): value is string => typeof value === "string") : [],
    note: normalizedType.unknown ? `unknown_action_type:${normalizedType.unknown}${rawNote ? ` | ${rawNote}` : ""}` : rawNote,
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

export function parseSession(rawSession: RawSession): ParseResult {
  const warnings: string[] = [];
  const heroSeatId = typeof rawSession.heroSeatId === "string" ? rawSession.heroSeatId : typeof rawSession.heroId === "string" ? rawSession.heroId : null;
  const hands = Array.isArray(rawSession.hands)
    ? rawSession.hands.map((hand, index) => parseHand(hand, heroSeatId, index + 1))
    : [];

  if (!hands.length) warnings.push("No hands found in session export.");
  if (!heroSeatId && !hands.some((hand) => hand.heroSeat)) warnings.push("Hero seat was missing; strategic review may be skipped.");
  if (rawSession.schemaVersion === undefined) warnings.push("Schema version missing; treated as a legacy export and validated conservatively.");

  const session: Session = {
    id: normalizeString(rawSession.id ?? rawSession.sessionId, "session-import"),
    createdAt: typeof rawSession.createdAt === "string" ? rawSession.createdAt : null,
    roomPolicy: normalizeString(rawSession.roomPolicy, "Pocket Pixel Poker"),
    sourceMode: typeof rawSession.mode === "string" ? rawSession.mode : typeof rawSession.philosophy === "string" ? rawSession.philosophy : null,
    heroSeatId,
    stakes: typeof rawSession.stakes === "string" ? rawSession.stakes : null,
    schemaVersion: rawSession.schemaVersion === undefined ? null : String(rawSession.schemaVersion),
    hands,
    summaryStats: rawSession.summaryStats && typeof rawSession.summaryStats === "object" ? rawSession.summaryStats : {},
  };

  return {
    session,
    warnings,
    integrity: validateSession(session),
  };
}
