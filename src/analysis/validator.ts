import type { Action, Hand, HandImportReport, HandValidity, IntegrityIssue, Session, SessionIntegrityReport, Street } from "./types";

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
const SUPPORTED_SCHEMA_VERSIONS = new Set(["1", "1.0", "2", "2.0"]);

interface SeatState {
  stack: number | null;
  investedStreet: number;
  investedHand: number;
  folded: boolean;
  allIn: boolean;
  busted: boolean;
  inactive: boolean;
}

interface ValidationState {
  pot: number;
  currentStreet: Street;
  streetBet: number;
  activeActors: Set<string>;
  liveActors: Set<string>;
  actedSinceAggression: Set<string>;
  seatStates: Map<string, SeatState>;
  issues: IntegrityIssue[];
  unsupportedFields: Set<string>;
  exactBreakActionIndex: number | null;
  lastActorId: string | null;
  lastStreet: Street;
}

function pushIssue(
  state: ValidationState,
  issue: Omit<IntegrityIssue, "severity"> & { severity?: "error" | "warning" },
): void {
  state.issues.push({ severity: issue.severity ?? "error", ...issue });
  if (issue.severity !== "warning" && typeof issue.actionIndex === "number" && state.exactBreakActionIndex === null) {
    state.exactBreakActionIndex = issue.actionIndex;
  }
}

function seatIds(hand: Hand): Set<string> {
  return new Set(hand.seats.map((seat) => seat.id));
}

function normalizeSchemaVersion(schemaVersion: string | null): string | null {
  if (!schemaVersion) return null;
  return schemaVersion.trim();
}

function strongestStatus(issues: IntegrityIssue[]): HandValidity {
  if (issues.some((issue) => issue.category === "invalid_schema" && issue.severity === "error")) return "invalid_schema";
  if (issues.some((issue) => issue.category === "invalid_sequence" && issue.severity === "error")) return "invalid_sequence";
  if (issues.some((issue) => issue.category === "invalid_accounting" && issue.severity === "error")) return "invalid_accounting";
  if (issues.some((issue) => issue.category === "unsupported" && issue.severity === "error")) return "unsupported";
  return "valid";
}

function inferConfidence(validHands: number, totalHands: number): { confidence: SessionIntegrityReport["confidence"]; reason: string } {
  if (totalHands === 0) return { confidence: "low", reason: "No hands were imported." };
  const ratio = validHands / totalHands;
  if (validHands < 5 || ratio < 0.4) {
    return { confidence: "low", reason: `Only ${validHands} of ${totalHands} hands were valid enough for strategic scoring.` };
  }
  if (validHands < 12 || ratio < 0.7) {
    return { confidence: "medium", reason: `${validHands} of ${totalHands} hands passed integrity checks, so strategic conclusions are only moderately reliable.` };
  }
  return { confidence: "high", reason: `${validHands} of ${totalHands} hands passed integrity checks.` };
}

function isStreetClosed(state: ValidationState): boolean {
  for (const actorId of state.liveActors) {
    const seat = state.seatStates.get(actorId);
    if (!seat || seat.folded || seat.allIn || seat.inactive || seat.busted) continue;
    if (seat.investedStreet !== state.streetBet) return false;
    if (!state.actedSinceAggression.has(actorId)) return false;
  }
  return true;
}

function advanceStreet(state: ValidationState, nextStreet: Street, actionIndex: number): void {
  if (nextStreet === state.currentStreet) return;
  const currentIndex = STREET_ORDER.indexOf(state.currentStreet);
  const nextIndex = STREET_ORDER.indexOf(nextStreet);
  if (nextIndex < currentIndex || nextIndex - currentIndex > 1) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "street_regression",
      message: `Street progression broke at action ${actionIndex + 1}: ${state.currentStreet} -> ${nextStreet}.`,
      street: nextStreet,
      actionIndex,
    });
    return;
  }
  if (!isStreetClosed(state) && state.liveActors.size > 1) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "street_advanced_before_closure",
      message: `Street changed to ${nextStreet} before betting was closed on ${state.currentStreet}.`,
      street: nextStreet,
      actionIndex,
    });
  }
  state.currentStreet = nextStreet;
  state.streetBet = 0;
  state.actedSinceAggression = new Set();
  for (const seatState of state.seatStates.values()) {
    seatState.investedStreet = 0;
  }
}

function activeLiveActors(state: ValidationState): string[] {
  return [...state.liveActors].filter((actorId) => {
    const seat = state.seatStates.get(actorId);
    return seat && !seat.folded && !seat.inactive && !seat.busted;
  });
}

function evaluateActionLegality(state: ValidationState, hand: Hand, action: Action, actionIndex: number): void {
  const actorSeat = state.seatStates.get(action.actorId);
  if (!actorSeat) {
    pushIssue(state, {
      category: "invalid_schema",
      code: "unknown_actor",
      message: `Action ${actionIndex + 1} references actor ${action.actorId}, which is not a seat in the hand.`,
      actionIndex,
      street: action.street,
      field: "actions[].actorId",
    });
    return;
  }

  if (
    state.lastActorId === action.actorId &&
    state.lastStreet === action.street &&
    activeLiveActors(state).length > 1 &&
    !["post_blind", "ante"].includes(action.type)
  ) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "repeated_same_player_action",
      message: `Seat ${action.actorId} acted twice in a row on ${action.street} without turn order changing.`,
      actionIndex,
      street: action.street,
    });
  }

  if (actorSeat.busted || actorSeat.inactive) {
    pushIssue(state, {
      category: "invalid_accounting",
      code: "inactive_or_busted_actor",
      message: `Seat ${action.actorId} acted despite being busted or inactive.`,
      actionIndex,
      street: action.street,
    });
  }

  if (action.note?.startsWith("unknown_action_type:")) {
    pushIssue(state, {
      category: "invalid_schema",
      code: "unknown_action_type",
      message: `Action ${actionIndex + 1} used an unsupported action type.`,
      actionIndex,
      street: action.street,
      field: "hands[].actions[].type",
    });
  }

  if (actorSeat.folded) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "folded_seat_acted",
      message: `Seat ${action.actorId} acted after folding.`,
      actionIndex,
      street: action.street,
    });
  }

  const toCall = Math.max(0, state.streetBet - actorSeat.investedStreet);
  const remainingStack = actorSeat.stack === null ? null : actorSeat.stack;
  const isAllInMove = action.type === "all_in";

  if (action.type === "post_blind" || action.type === "ante") {
    if (state.currentStreet !== "preflop") {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "blind_outside_preflop",
        message: `${action.type} appeared on ${action.street} instead of preflop.`,
        actionIndex,
        street: action.street,
      });
    }
    if (actorSeat.busted || actorSeat.inactive) {
      pushIssue(state, {
        category: "invalid_accounting",
        code: "busted_posted_blind",
        message: `Busted or inactive seat ${action.actorId} posted forced money.`,
        actionIndex,
        street: action.street,
      });
    }
  }

  if (action.type === "check" && toCall > 0) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "illegal_check",
      message: `Seat ${action.actorId} checked while facing ${toCall}.`,
      actionIndex,
      street: action.street,
    });
  }

  if (action.type === "call") {
    if (toCall <= 0) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "impossible_call_label",
        message: `Seat ${action.actorId} was labeled as a call without facing a bet.`,
        actionIndex,
        street: action.street,
      });
    }
    if (action.amount <= 0) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "impossible_call_label",
        message: `Seat ${action.actorId} was labeled as a call with no positive matching amount.`,
        actionIndex,
        street: action.street,
      });
    }
    if (action.amount <= 0 || action.amount > toCall + 0.0001) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "call_amount_mismatch",
        message: `Seat ${action.actorId} called for ${action.amount}, but the required call was ${toCall}.`,
        actionIndex,
        street: action.street,
      });
    }
  }

  if (action.type === "fold" && toCall <= 0) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "free_fold",
      message: `Seat ${action.actorId} folded when a check was available.`,
      actionIndex,
      street: action.street,
    });
  }

  if (action.type === "bet") {
    if (toCall > 0) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "bet_when_facing_action",
        message: `Seat ${action.actorId} bet while facing ${toCall}; this should be a call, raise, or all-in.`,
        actionIndex,
        street: action.street,
      });
    }
    if (action.amount <= 0) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "zero_bet",
        message: `Seat ${action.actorId} bet a non-positive amount.`,
        actionIndex,
        street: action.street,
      });
    }
  }

  if (action.type === "raise") {
    const targetAmount = action.toAmount ?? actorSeat.investedStreet + action.amount;
    if (toCall <= 0) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "raise_without_bet_to_face",
        message: `Seat ${action.actorId} raised when no bet was outstanding.`,
        actionIndex,
        street: action.street,
      });
    }
    if (targetAmount <= state.streetBet) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "raise_not_above_call",
        message: `Seat ${action.actorId} was labeled as a raise without increasing the live bet.`,
        actionIndex,
        street: action.street,
      });
    }
    if (action.amount <= toCall) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "raise_amount_too_small",
        message: `Seat ${action.actorId} used a raise label for an amount that only covers the call.`,
        actionIndex,
        street: action.street,
      });
    }
  }

  if (isAllInMove && remainingStack !== null && Math.abs(action.amount - remainingStack) > 0.0001) {
    pushIssue(state, {
      category: "invalid_accounting",
      code: "all_in_amount_mismatch",
      message: `Seat ${action.actorId} was labeled all-in for ${action.amount}, but ${remainingStack} remained.`,
      actionIndex,
      street: action.street,
    });
  }

  if (remainingStack !== null && action.amount - remainingStack > 0.0001) {
    pushIssue(state, {
      category: "invalid_accounting",
      code: "stack_underflow",
      message: `Seat ${action.actorId} invested ${action.amount} with only ${remainingStack} available.`,
      actionIndex,
      street: action.street,
    });
  }

  if (action.type === "fold") {
    actorSeat.folded = true;
    state.liveActors.delete(action.actorId);
    state.actedSinceAggression.add(action.actorId);
    return;
  }

  const appliedAmount = Math.max(0, action.amount);
  state.pot += appliedAmount;
  actorSeat.investedStreet += appliedAmount;
  actorSeat.investedHand += appliedAmount;
  if (actorSeat.stack !== null) {
    actorSeat.stack -= appliedAmount;
    if (actorSeat.stack < -0.0001) {
      pushIssue(state, {
        category: "invalid_accounting",
        code: "negative_stack",
        message: `Seat ${action.actorId} dropped below zero chips after action ${actionIndex + 1}.`,
        actionIndex,
        street: action.street,
      });
    }
    if (actorSeat.stack <= 0.0001) actorSeat.allIn = true;
  }

  if (action.type === "post_blind") {
    state.streetBet = Math.max(state.streetBet, actorSeat.investedStreet);
  }

  const isAggressive = action.type === "bet" || action.type === "raise" || (isAllInMove && appliedAmount > toCall);
  if (isAggressive) {
    state.streetBet = Math.max(state.streetBet, actorSeat.investedStreet);
    state.actedSinceAggression = new Set([action.actorId]);
  } else {
    state.actedSinceAggression.add(action.actorId);
  }

  if (isAllInMove && actorSeat.stack === null) actorSeat.allIn = true;

  const survivors = activeLiveActors(state);
  if (survivors.length === 1 && actionIndex < hand.actions.length - 1) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "actions_after_winner_determined",
      message: `Further actions were logged after only one live seat remained.`,
      actionIndex: actionIndex + 1,
      street: hand.actions[actionIndex + 1]?.street,
    });
  }

  state.lastActorId = action.actorId;
  state.lastStreet = action.street;
}

function validateResults(hand: Hand, state: ValidationState): void {
  const payoutsRaw = hand.results.payouts;
  if (payoutsRaw && typeof payoutsRaw === "object") {
    const payouts = Object.values(payoutsRaw as Record<string, unknown>)
      .map((value) => (typeof value === "number" ? value : null))
      .filter((value): value is number => value !== null);
    const payoutTotal = payouts.reduce((sum, value) => sum + value, 0);
    if (Math.abs(payoutTotal - state.pot) > 0.0001) {
      pushIssue(state, {
        category: "invalid_accounting",
        code: "payout_mismatch",
        message: `Payout total ${payoutTotal} did not match contributed pot ${state.pot}.`,
      });
    }
  } else {
    state.unsupportedFields.add("results.payouts");
  }

  const showdown = hand.results.showdown;
  if (showdown !== undefined) {
    if (!Array.isArray(hand.board) || hand.board.length < 5) {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "malformed_showdown",
        message: "Showdown data was present without a full five-card board.",
      });
    }
    if (!showdown || typeof showdown !== "object") {
      pushIssue(state, {
        category: "invalid_sequence",
        code: "malformed_showdown",
        message: "Showdown payload was malformed.",
      });
    }
  }
}

function validateBlindRotation(previous: Hand | null, current: Hand, report: HandImportReport): void {
  if (!previous?.buttonSeatId || !current.buttonSeatId) return;
  const previousSeats = previous.seats.filter((seat) => !seat.inactive && !seat.busted).map((seat) => seat.id);
  const currentSeats = current.seats.filter((seat) => !seat.inactive && !seat.busted).map((seat) => seat.id);
  if (previousSeats.length < 3 || previousSeats.join("|") !== currentSeats.join("|")) return;
  if (!currentSeats.includes(current.buttonSeatId)) {
    report.issues.push({
      category: "invalid_accounting",
      code: "button_on_inactive_seat",
      severity: "error",
      message: `Button seat ${current.buttonSeatId} was not active in the current hand.`,
    });
    report.status = "invalid_accounting";
    report.engineBugDetected = true;
    if (report.exactBreakActionIndex === null) report.exactBreakActionIndex = 0;
    return;
  }
  if (previous.buttonSeatId === current.buttonSeatId) {
    report.issues.push({
      category: "invalid_accounting",
      code: "blind_rotation_inconsistent",
      severity: "error",
      message: `Button stayed on ${current.buttonSeatId} across consecutive hands despite unchanged active seats.`,
    });
    report.status = "invalid_accounting";
    report.engineBugDetected = true;
    if (report.exactBreakActionIndex === null) report.exactBreakActionIndex = 0;
  }
}

export function validateHand(hand: Hand): HandImportReport {
  const issues: IntegrityIssue[] = [];
  const unsupportedFields = new Set<string>();
  const ids = seatIds(hand);

  if (!hand.seats.length) {
    issues.push({
      category: "invalid_schema",
      code: "missing_seats",
      severity: "error",
      message: "Hand is missing seats.",
      field: "hands[].seats",
    });
  }

  if (!hand.actions.length) {
    issues.push({
      category: "invalid_schema",
      code: "missing_actions",
      severity: "error",
      message: "Hand is missing actions.",
      field: "hands[].actions",
    });
  }

  if (!hand.heroSeatId || !ids.has(hand.heroSeatId)) unsupportedFields.add("heroSeatId");
  if (hand.heroHoleCards.length < 2) unsupportedFields.add("heroHoleCards");

  for (const [index, action] of hand.actions.entries()) {
    if (!ids.has(action.actorId)) {
      issues.push({
        category: "invalid_schema",
        code: "unknown_actor",
        severity: "error",
        message: `Action ${index + 1} references unknown actor ${action.actorId}.`,
        actionIndex: index,
        street: action.street,
        field: "hands[].actions[].actorId",
      });
    }
  }

  const state: ValidationState = {
    pot: 0,
    currentStreet: "preflop",
    streetBet: 0,
    activeActors: ids,
    liveActors: new Set(hand.seats.filter((seat) => !seat.busted && !seat.inactive).map((seat) => seat.id)),
    actedSinceAggression: new Set(),
    seatStates: new Map(
      hand.seats.map((seat) => [
        seat.id,
        {
          stack: hand.stacks[seat.id] ?? seat.stack ?? null,
          investedStreet: 0,
          investedHand: 0,
          folded: false,
          allIn: false,
          busted: seat.busted,
          inactive: seat.inactive,
        },
      ]),
    ),
    issues,
    unsupportedFields,
    exactBreakActionIndex: null,
    lastActorId: null,
    lastStreet: "preflop",
  };

  for (const [index, action] of hand.actions.entries()) {
    advanceStreet(state, action.street, index);
    evaluateActionLegality(state, hand, action, index);
  }

  if (hand.actions.length && !isStreetClosed(state) && activeLiveActors(state).length > 1) {
    pushIssue(state, {
      category: "invalid_sequence",
      code: "hand_ended_before_closure",
      message: `Hand ended before betting was closed on ${state.currentStreet}.`,
      street: state.currentStreet,
      actionIndex: hand.actions.length - 1,
    });
  }

  validateResults(hand, state);

  const status = strongestStatus(state.issues);
  const strategicallyScorable = status === "valid" && !unsupportedFields.has("heroSeatId") && !unsupportedFields.has("heroHoleCards");
  return {
    handId: hand.id,
    handNumber: hand.handNumber,
    status,
    issues: state.issues,
    unsupportedFields: [...unsupportedFields],
    exactBreakActionIndex: state.exactBreakActionIndex,
    engineBugDetected: status !== "valid",
    strategicallyScorable,
    analysisDisposition: status === "valid" ? (strategicallyScorable ? "full" : "partial") : "skipped",
  };
}

export function validateSession(session: Session): SessionIntegrityReport {
  const schemaVersion = normalizeSchemaVersion(session.schemaVersion);
  const handReports = session.hands.map((hand) => validateHand(hand));

  if (schemaVersion && !SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    for (const report of handReports) {
      report.issues.push({
        category: "unsupported",
        code: "unsupported_schema_version",
        severity: "error",
        message: `Schema version ${schemaVersion} is not supported by this analyzer.`,
        field: "schemaVersion",
      });
      report.status = "unsupported";
      report.engineBugDetected = true;
      report.analysisDisposition = "skipped";
      report.strategicallyScorable = false;
    }
  }

  for (let index = 1; index < session.hands.length; index += 1) {
    validateBlindRotation(session.hands[index - 1], session.hands[index], handReports[index]);
  }

  const validHands = handReports.filter((report) => report.status === "valid" && report.strategicallyScorable).length;
  const invalidHands = handReports.filter((report) => report.status !== "valid").length;
  const unscoredHands = handReports.filter((report) => !report.strategicallyScorable).length;
  const confidence = inferConfidence(validHands, session.hands.length);
  const engineIssueCounts = new Map<string, number>();
  const unsupportedFields = new Set<string>();

  for (const report of handReports) {
    for (const issue of report.issues) {
      engineIssueCounts.set(issue.code, (engineIssueCounts.get(issue.code) ?? 0) + 1);
    }
    for (const field of report.unsupportedFields) unsupportedFields.add(field);
  }

  const biggestEngineFaultCategory =
    [...engineIssueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sessionStatus: HandValidity =
    schemaVersion && !SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)
      ? "unsupported"
      : invalidHands > 0
        ? strongestStatus(handReports.flatMap((report) => report.issues))
        : "valid";

  return {
    schemaVersion,
    sessionStatus,
    totalHands: session.hands.length,
    validHands,
    invalidHands,
    unscoredHands,
    confidence: confidence.confidence,
    confidenceReason: confidence.reason,
    mainFailureSource:
      invalidHands > validHands ? "Main failure source was engine integrity, not player decision quality." : "Most scored feedback came from structurally valid hands.",
    biggestEngineFaultCategory,
    unsupportedFields: [...unsupportedFields],
    handReports,
  };
}
