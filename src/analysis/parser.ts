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

const IGNORED_ACTION_TYPES = new Set(["coach_hint", "deal", "street_advance", "show", "muck", "win", "bust"]);

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

function normalizeSeatId(input: unknown): string | null {
  if (typeof input === "string" && input.trim()) return input;
  if (typeof input === "number" && Number.isFinite(input)) return `seat-${input}`;
  return null;
}

function flattenBoard(rawBoard: RawHand["board"]): string[] {
  if (Array.isArray(rawBoard)) {
    return rawBoard.filter((card): card is string => typeof card === "string");
  }
  if (rawBoard && typeof rawBoard === "object") {
    const boardState = rawBoard as { flop?: unknown; turn?: unknown; river?: unknown };
    const flop = Array.isArray(boardState.flop) ? boardState.flop.filter((card): card is string => typeof card === "string") : [];
    const turn = typeof boardState.turn === "string" ? [boardState.turn] : [];
    const river = typeof boardState.river === "string" ? [boardState.river] : [];
    return [...flop, ...turn, ...river];
  }
  return [];
}

function seatIdLookup(rawSeats: RawSeat[]): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const [index, rawSeat] of rawSeats.entries()) {
    const numericSeat = typeof rawSeat.seat === "number" ? rawSeat.seat : index;
    lookup.set(numericSeat, normalizeSeatId(rawSeat.id ?? rawSeat.playerId ?? rawSeat.seat) ?? fallbackId("seat", index + 1));
  }
  return lookup;
}

function parseSeat(rawSeat: RawSeat, sessionHeroSeatId: string | null, index: number): Seat {
  const id = normalizeSeatId(rawSeat.id ?? rawSeat.playerId ?? rawSeat.seat) ?? fallbackId("seat", index);
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

function parseAction(rawAction: RawAction, heroSeatId: string | null, seatsByNumber: Map<number, string>): Action | null {
  const rawType = typeof rawAction.type === "string" ? rawAction.type : typeof rawAction.action === "string" ? rawAction.action : undefined;
  if (rawType && IGNORED_ACTION_TYPES.has(rawType.toLowerCase())) return null;
  const actorId =
    normalizeSeatId(rawAction.actorId ?? rawAction.seatId ?? rawAction.playerId)
    ?? (typeof rawAction.actorSeat === "number" ? seatsByNumber.get(rawAction.actorSeat) ?? normalizeSeatId(rawAction.actorSeat) : null)
    ?? "unknown";
  const normalizedType = normalizeActionType(rawType);
  const rawNote = typeof rawAction.note === "string" ? rawAction.note : null;
  return {
    actorId,
    street: normalizeStreet(rawAction.street),
    type: normalizedType.type,
    amount: normalizeNumber(rawAction.amount, 0),
    toAmount: typeof rawAction.toAmount === "number" ? rawAction.toAmount : null,
    pot:
      typeof rawAction.pot === "number"
        ? rawAction.pot
        : typeof rawAction.potAfter === "number"
          ? rawAction.potAfter
          : typeof rawAction.potBefore === "number"
            ? rawAction.potBefore
            : null,
    board: Array.isArray(rawAction.board) ? rawAction.board.filter((value): value is string => typeof value === "string") : [],
    note: normalizedType.unknown ? `unknown_action_type:${normalizedType.unknown}${rawNote ? ` | ${rawNote}` : ""}` : rawNote,
    isHero: Boolean(rawAction.isHero) || (heroSeatId !== null && actorId === heroSeatId),
  };
}

function parseHand(rawHand: RawHand, sessionHeroSeatId: string | null, fallbackNumber: number): Hand {
  const handResults =
    rawHand.results && typeof rawHand.results === "object"
      ? rawHand.results
      : rawHand.result && typeof rawHand.result === "object"
        ? rawHand.result
        : {};
  const derivedHeroSeatId =
    normalizeSeatId(rawHand.summary?.heroSeatId ?? rawHand.heroSeatId ?? handResults.heroSeatId)
    ?? normalizeSeatId(rawHand.heroSeat)
    ?? sessionHeroSeatId;
  const rawSeats = Array.isArray(rawHand.seats)
    ? rawHand.seats
    : Array.isArray(rawHand.activePlayersAtStart)
      ? rawHand.activePlayersAtStart
      : [];
  const seats = rawSeats.map((seat, index) => parseSeat(seat, derivedHeroSeatId || null, index + 1));
  const heroSeat = seats.find((seat) => seat.isHero) ?? null;
  const normalizedHeroSeatId = heroSeat?.id ?? derivedHeroSeatId ?? null;
  const seatsByNumber = seatIdLookup(rawSeats);
  const actions = Array.isArray(rawHand.actions)
    ? rawHand.actions
        .map((action) => parseAction(action, normalizedHeroSeatId, seatsByNumber))
        .filter((action): action is Action => action !== null)
    : [];
  const payouts =
    Array.isArray((handResults as { winners?: unknown }).winners) && normalizedHeroSeatId
      ? Object.fromEntries(
          seats.map((seat) => {
            const winningSeat = ((handResults as { winners?: Array<Record<string, unknown>> }).winners ?? []).find(
              (winner) => normalizeSeatId(winner.seat) === seat.id,
            );
            return [seat.id, typeof winningSeat?.amountWon === "number" ? winningSeat.amountWon : 0];
          }),
        )
      : undefined;
  const heroWon =
    typeof (handResults as { heroWon?: unknown }).heroWon === "boolean"
      ? (handResults as { heroWon: boolean }).heroWon
      : Array.isArray((handResults as { winnerSeats?: unknown[] }).winnerSeats) && normalizedHeroSeatId
        ? (handResults as { winnerSeats: unknown[] }).winnerSeats.some((seat) => normalizeSeatId(seat) === normalizedHeroSeatId)
        : undefined;
  const normalizedResults: Record<string, unknown> = { ...handResults };
  if (payouts) normalizedResults.payouts = payouts;
  if (typeof heroWon === "boolean") normalizedResults.heroWon = heroWon;
  if ((handResults as { showdown?: unknown }).showdown) normalizedResults.showdown = {};

  return {
    id: normalizeString(rawHand.id ?? rawHand.handId, `hand-${fallbackNumber}`),
    handNumber: typeof rawHand.handNumber === "number" ? rawHand.handNumber : fallbackNumber,
    heroSeatId: normalizedHeroSeatId,
    buttonSeatId:
      normalizeSeatId(rawHand.buttonSeatId)
      ?? (typeof rawHand.buttonSeat === "number" ? seatsByNumber.get(rawHand.buttonSeat) ?? normalizeSeatId(rawHand.buttonSeat) : null)
      ?? null,
    seats,
    heroSeat,
    heroHoleCards:
      (Array.isArray(rawHand.heroHoleCards) ? rawHand.heroHoleCards : Array.isArray(rawHand.holeCards) ? rawHand.holeCards : []).filter(
        (card): card is string => typeof card === "string",
      ),
    actions,
    board: flattenBoard(rawHand.board),
    results: normalizedResults,
    stacks:
      rawHand.stacks && typeof rawHand.stacks === "object"
        ? (rawHand.stacks as Record<string, number>)
        : rawHand.startingStacks && typeof rawHand.startingStacks === "object"
          ? Object.fromEntries(Object.entries(rawHand.startingStacks).map(([key, value]) => [normalizeSeatId(Number(key)) ?? key, value]))
          : {},
    summary: rawHand.summary && typeof rawHand.summary === "object" ? rawHand.summary : {},
  };
}

export function parseSession(rawSession: RawSession): ParseResult {
  const warnings: string[] = [];
  const heroSeatId =
    normalizeSeatId(rawSession.heroSeatId ?? rawSession.heroId)
    ?? normalizeSeatId(rawSession.session?.heroSeat)
    ?? (Array.isArray(rawSession.players)
      ? rawSession.players
          .map((seat, index) => parseSeat(seat, null, index + 1))
          .find((seat) => seat.isHero)?.id ?? null
      : null);
  const hands = Array.isArray(rawSession.hands)
    ? rawSession.hands.map((hand, index) => parseHand(hand, heroSeatId, index + 1))
    : [];

  if (!hands.length) warnings.push("No hands found in session export.");
  if (!heroSeatId && !hands.some((hand) => hand.heroSeat)) warnings.push("Hero seat was missing; strategic review may be skipped.");
  if (rawSession.schemaVersion === undefined) warnings.push("Schema version missing; treated as a legacy export and validated conservatively.");

  const session: Session = {
    id: normalizeString(rawSession.id ?? rawSession.sessionId ?? rawSession.session?.id, "session-import"),
    createdAt: typeof rawSession.createdAt === "string" ? rawSession.createdAt : typeof rawSession.session?.startedAt === "string" ? rawSession.session.startedAt : null,
    roomPolicy: normalizeString(rawSession.roomPolicy ?? rawSession.session?.roomPolicy, "Pocket Pixel Poker"),
    sourceMode:
      typeof rawSession.mode === "string"
        ? rawSession.mode
        : typeof rawSession.philosophy === "string"
          ? rawSession.philosophy
          : typeof rawSession.session?.mode === "string"
            ? rawSession.session.mode
            : null,
    heroSeatId,
    stakes: typeof rawSession.stakes === "string" ? rawSession.stakes : null,
    schemaVersion: rawSession.schemaVersion === undefined ? null : String(rawSession.schemaVersion),
    hands,
    summaryStats:
      rawSession.summaryStats && typeof rawSession.summaryStats === "object"
        ? rawSession.summaryStats
        : rawSession.summary && typeof rawSession.summary === "object"
          ? rawSession.summary
          : {},
  };

  return {
    session,
    warnings,
    integrity: validateSession(session),
  };
}
