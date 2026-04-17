import { CATEGORY_KEYS } from "./constants";
import { buildRecommendations } from "./recommendations";
import { reconstructHand } from "./reconstructor";
import { alphaGrade, average, clamp } from "./utils";
import type {
  Action,
  AnalysisMode,
  CategoryKey,
  DecisionReview,
  Hand,
  HandContext,
  HandImportReport,
  HandReview,
  ParseResult,
  Recommendation,
  RuleTrigger,
  SessionReport,
  Street,
} from "./types";

interface RuntimeDecisionContext {
  action: Action;
  actionIndex: number;
  hand: Hand;
  handContext: HandContext;
  potBefore: number;
  toCall: number;
  currentStreet: Street;
  preflopAggressionCountBeforeHero: number;
  priorAggressiveActionsOnStreet: number;
}

function baselineCategoryScores(): Record<CategoryKey, number> {
  return {
    preflopDiscipline: 70,
    initiative: 68,
    positionUse: 70,
    archetypeAdjustment: 68,
    sizing: 70,
    valueShowdown: 70,
    riskControl: 72,
    coherence: 69,
  };
}

function bucketAllowedToOpen(position: HandContext["heroPosition"], bucket: HandContext["heroPreflopBucket"]): boolean {
  const table: Record<HandContext["heroPosition"], HandContext["heroPreflopBucket"][]> = {
    utg: ["premium_pair", "strong_pair", "premium_broadway", "strong_broadway", "suited_ace"],
    hj: ["premium_pair", "strong_pair", "small_pair", "premium_broadway", "strong_broadway", "suited_ace", "suited_connector"],
    co: [
      "premium_pair",
      "strong_pair",
      "small_pair",
      "premium_broadway",
      "strong_broadway",
      "suited_ace",
      "suited_connector",
      "suited_gapper",
    ],
    btn: [
      "premium_pair",
      "strong_pair",
      "small_pair",
      "premium_broadway",
      "strong_broadway",
      "suited_ace",
      "suited_connector",
      "suited_gapper",
      "weak_offsuit_broadway",
      "weak_suited_trash",
    ],
    sb: ["premium_pair", "strong_pair", "small_pair", "premium_broadway", "strong_broadway", "suited_ace", "suited_connector"],
    bb: ["premium_pair", "strong_pair", "small_pair", "premium_broadway", "strong_broadway", "suited_ace", "suited_connector"],
    unknown: ["premium_pair", "strong_pair", "premium_broadway", "strong_broadway", "suited_ace"],
  };
  return table[position].includes(bucket);
}

function pushRule(triggers: RuleTrigger[], trigger: RuleTrigger): void {
  triggers.push(trigger);
}

function evaluateDecisionRules(runtime: RuntimeDecisionContext, mode: AnalysisMode): RuleTrigger[] {
  const { action, handContext, toCall, potBefore, preflopAggressionCountBeforeHero, priorAggressiveActionsOnStreet } = runtime;
  const triggers: RuleTrigger[] = [];
  const villain = handContext.dominantVillainArchetype.name;
  const aggressive = ["bet", "raise", "all_in"].includes(action.type);
  const weakPair = handContext.postflopBucket === "top_pair_weak_kicker" || handContext.postflopBucket === "weak_showdown";
  const strongMade = ["two_pair", "set", "straight", "flush", "strong_made_hand", "near_nut_hand", "overpair"].includes(handContext.postflopBucket);

  if (action.street === "preflop" && preflopAggressionCountBeforeHero === 0 && priorAggressiveActionsOnStreet === 0 && ["raise", "bet", "all_in", "call"].includes(action.type)) {
    if (bucketAllowedToOpen(handContext.heroPosition, handContext.heroPreflopBucket)) {
      if (aggressive) {
        pushRule(triggers, {
          id: "open_range_discipline",
          label: "Opening range discipline",
          category: "preflopDiscipline",
          impact: 8,
          outcome: "credit",
          explanation: `Hero opened a position-appropriate bucket from ${handContext.heroPosition}.`,
        });
      }
    } else if (aggressive || action.type === "call") {
      pushRule(triggers, {
        id: "open_range_discipline",
        label: "Opening range discipline",
        category: "preflopDiscipline",
        impact: -12,
        outcome: "mistake",
        explanation: `Hero entered with ${handContext.heroPreflopBucket} from ${handContext.heroPosition}, outside the configured opening discipline.`,
      });
    }
  }

  if (action.street === "preflop" && toCall > 0) {
    const weakPreflop = ["offsuit_trash", "weak_suited_trash", "weak_offsuit_broadway"].includes(handContext.heroPreflopBucket);
    if (action.type === "fold" && weakPreflop) {
      pushRule(triggers, {
        id: "discipline_fold",
        label: "Discipline credit for correct fold",
        category: "riskControl",
        impact: 8,
        outcome: "credit",
        explanation: `Hero folded ${handContext.heroPreflopBucket} while facing action instead of forcing a dominated continue.`,
      });
    }
    if (["call", "raise", "all_in"].includes(action.type) && weakPreflop) {
      pushRule(triggers, {
        id: "facing_raise_discipline",
        label: "Facing raise / 3-bet discipline",
        category: "preflopDiscipline",
        impact: -13,
        outcome: "mistake",
        explanation: `Hero continued with ${handContext.heroPreflopBucket} while facing a raise.`,
      });
    }
    if (preflopAggressionCountBeforeHero >= 2 && ["call", "raise", "all_in"].includes(action.type) && !["premium_pair", "strong_pair", "premium_broadway"].includes(handContext.heroPreflopBucket)) {
      pushRule(triggers, {
        id: "three_bet_discipline",
        label: "Facing raise / 3-bet discipline",
        category: "riskControl",
        impact: -11,
        outcome: "mistake",
        explanation: "Hero continued into heavy preflop aggression without a premium continuing range.",
      });
    }
  }

  if (action.street === "preflop" && aggressive && villain === "Calling Station" && preflopAggressionCountBeforeHero === 0) {
    pushRule(triggers, {
      id: "isolation_vs_calling_station",
      label: "Isolation/value aggression versus calling station",
      category: "initiative",
      impact: 7,
      outcome: "credit",
      explanation: "Hero took initiative against a calling-station profile instead of limping along.",
    });
  }

  if (action.street !== "preflop" && aggressive && strongMade && villain === "Calling Station") {
    pushRule(triggers, {
      id: "value_vs_calling_station",
      label: "Isolation/value aggression versus calling station",
      category: "valueShowdown",
      impact: 9,
      outcome: "credit",
      explanation: "Hero pushed value into a calling-station line with a hand strong enough to get paid.",
    });
  }

  if (action.street !== "preflop" && aggressive && villain === "Nit" && ["air", "weak_showdown", "top_pair_weak_kicker"].includes(handContext.postflopBucket)) {
    pushRule(triggers, {
      id: "caution_vs_nit",
      label: "Caution versus nit-heavy lines",
      category: "archetypeAdjustment",
      impact: -8,
      outcome: "caution",
      explanation: "Hero applied pressure into a nit-heavy line without a strong enough value bucket.",
    });
  }

  if (action.street !== "preflop" && action.type === "fold" && villain === "Nit" && handContext.villainAggressionFaced > 0) {
    pushRule(triggers, {
      id: "disciplined_fold_vs_nit",
      label: "Discipline credit for correct fold",
      category: "riskControl",
      impact: 6,
      outcome: "credit",
      explanation: "Hero respected a nit-heavy aggression line with a fold.",
    });
  }

  if (action.street !== "preflop" && aggressive && weakPair && action.amount >= Math.max(potBefore * 0.6, toCall * 2)) {
    pushRule(triggers, {
      id: "overplay_weak_one_pair",
      label: "Obvious overplay of weak one-pair hands",
      category: "riskControl",
      impact: -11,
      outcome: "mistake",
      explanation: "Hero inflated the pot with weak one-pair showdown value.",
    });
  }

  if (
    action.street !== "preflop" &&
    aggressive &&
    potBefore > 0 &&
    action.amount >= potBefore * 0.75 &&
    ["air", "weak_showdown", "top_pair_weak_kicker"].includes(handContext.postflopBucket)
  ) {
    pushRule(triggers, {
      id: "major_spew_oversized_pot",
      label: "Major spew flags in oversized pots",
      category: "sizing",
      impact: -15,
      outcome: "mistake",
      explanation: "Hero committed an oversized bet with an insufficient value or equity bucket.",
    });
  }

  if (
    action.street !== "preflop" &&
    action.type === "all_in" &&
    ["air", "weak_showdown", "top_pair_weak_kicker", "draw", "combo_draw"].includes(handContext.postflopBucket)
  ) {
    pushRule(triggers, {
      id: "major_spew_oversized_pot",
      label: "Major spew flags in oversized pots",
      category: "riskControl",
      impact: -12,
      outcome: "mistake",
      explanation: "Hero shoved a weak bluff-catching or no-showdown-value hand into a large pot.",
    });
  }

  if (action.street !== "preflop" && action.type === "call" && toCall > 0 && ["LAG", "Maniac"].includes(villain) && ["weak_showdown", "top_pair_weak_kicker", "top_pair_good_kicker"].includes(handContext.postflopBucket)) {
    pushRule(triggers, {
      id: "bluffcatch_vs_lag",
      label: "Wider bluff-catching allowance versus LAG/maniac archetypes",
      category: "archetypeAdjustment",
      impact: 6,
      outcome: "credit",
      explanation: "Hero bluff-caught against an aggressive archetype with enough showdown value.",
    });
  }

  if (mode === "sound_fundamentals" && action.street === "preflop" && action.type === "call" && handContext.heroPreflopBucket === "suited_gapper") {
    pushRule(triggers, {
      id: "sound_fundamentals_flat_penalty",
      label: "Facing raise / 3-bet discipline",
      category: "coherence",
      impact: -4,
      outcome: "caution",
      explanation: "Sound Fundamentals discounts speculative flats that do not win initiative.",
    });
  }

  if (mode === "adaptive_pressure" && action.street !== "preflop" && aggressive && villain === "Nit" && ["air", "draw", "weak_showdown"].includes(handContext.postflopBucket)) {
    pushRule(triggers, {
      id: "adaptive_pressure_vs_nit",
      label: "Caution versus nit-heavy lines",
      category: "initiative",
      impact: 4,
      outcome: "credit",
      explanation: "Adaptive Pressure allows more barreling into fold-prone nit-heavy lines.",
    });
  }

  return triggers;
}

function summarizeDecision(action: Action, triggers: RuleTrigger[]): string {
  if (!triggers.length) return `No explicit scoring rule fired for ${action.street} ${action.type}.`;
  return triggers.map((trigger) => `${trigger.label}: ${trigger.explanation}`).join(" ");
}

function buildDecisionReviews(hand: Hand, context: HandContext, mode: AnalysisMode): DecisionReview[] {
  const decisionReviews: DecisionReview[] = [];
  let currentStreet: Street = "preflop";
  let pot = 0;
  let streetBet = 0;
  let preflopAggressionCount = 0;
  let aggressiveActionsOnStreet = 0;
  const contributions = new Map<string, number>();

  for (const [actionIndex, action] of hand.actions.entries()) {
    if (action.street !== currentStreet) {
      currentStreet = action.street;
      streetBet = 0;
      aggressiveActionsOnStreet = 0;
      contributions.clear();
    }

    const contributed = contributions.get(action.actorId) ?? 0;
    const toCall = Math.max(0, streetBet - contributed);
    const potBefore = pot;

    if (action.isHero && !["post_blind", "ante"].includes(action.type)) {
      const triggers = evaluateDecisionRules(
        {
          action,
          actionIndex,
          hand,
          handContext: context,
          potBefore,
          toCall,
          currentStreet,
          preflopAggressionCountBeforeHero: preflopAggressionCount,
          priorAggressiveActionsOnStreet: aggressiveActionsOnStreet,
        },
        mode,
      );
      const scoreDelta = triggers.reduce((sum, trigger) => sum + trigger.impact, 0);
      const verdict = scoreDelta >= 8 ? "credit" : scoreDelta >= 2 ? "good" : scoreDelta <= -10 ? "mistake" : scoreDelta < 0 ? "questionable" : "neutral";
      decisionReviews.push({
        actionIndex,
        street: action.street,
        actionType: action.type,
        heroAction: `${action.street} ${action.type}${action.amount ? ` ${action.amount}` : ""}`,
        potBefore,
        facingBet: toCall,
        potOdds: toCall > 0 ? toCall / (potBefore + toCall) : null,
        spr: context.effectiveStack !== null && potBefore > 0 ? context.effectiveStack / potBefore : null,
        verdict,
        scoreDelta,
        ruleTriggers: triggers,
        summary: summarizeDecision(action, triggers),
      });
    }

    pot += action.amount;
    contributions.set(action.actorId, contributed + action.amount);
    if (["bet", "raise", "all_in"].includes(action.type)) {
      streetBet = Math.max(streetBet, (contributions.get(action.actorId) ?? 0));
      aggressiveActionsOnStreet += 1;
      if (action.street === "preflop") preflopAggressionCount += 1;
    }
  }

  return decisionReviews;
}

function buildCategoryScores(decisionReviews: DecisionReview[]): Record<CategoryKey, number> {
  const scores = baselineCategoryScores();
  for (const decision of decisionReviews) {
    for (const trigger of decision.ruleTriggers) {
      scores[trigger.category] = clamp(scores[trigger.category] + trigger.impact, 0, 100);
    }
  }
  return scores;
}

function chipResultForHand(hand: Hand): number {
  if (!hand.heroSeatId) return 0;
  const payouts = hand.results.payouts;
  if (payouts && typeof payouts === "object") {
    const heroPayout = (payouts as Record<string, unknown>)[hand.heroSeatId];
    if (typeof heroPayout === "number") return heroPayout;
  }
  return 0;
}

function summarizeValidHand(context: HandContext, decisionReviews: DecisionReview[], score: number): Omit<HandReview, "handId" | "handNumber" | "validity" | "badge" | "importReport" | "volatility" | "context"> {
  const credits = decisionReviews.filter((decision) => decision.verdict === "credit" || decision.verdict === "good");
  const cautionSpots = decisionReviews.filter((decision) => decision.verdict === "mistake" || decision.verdict === "questionable");
  const highestLeverageMistake = [...cautionSpots].sort((a, b) => a.scoreDelta - b.scoreDelta)[0] ?? null;
  const categoryScores = buildCategoryScores(decisionReviews);
  return {
    score,
    grade: alphaGrade(score),
    categoryScores,
    triggeredRules: decisionReviews.flatMap((decision) => decision.ruleTriggers),
    decisionReviews,
    summary: `Hero ${context.heroPosition.toUpperCase()} with ${context.hand.heroHoleCards.join(" ")}. Preflop chain: ${context.actionChain}. Result: ${context.resultLabel}`,
    conciseSummary: `${context.heroPosition.toUpperCase()} | ${context.lineSummary}`,
    whatWasGood: credits.slice(0, 3).map((decision) => decision.summary),
    whatWasQuestionable: cautionSpots.slice(0, 3).map((decision) => decision.summary),
    highestLeverageMistake: highestLeverageMistake?.summary ?? null,
    result: context.resultLabel,
    skippedReason: null,
  };
}

function summarizeInvalidHand(report: HandImportReport): Omit<HandReview, "handId" | "handNumber" | "validity" | "badge" | "importReport" | "volatility" | "context"> {
  const reasons = report.issues.map((issue) => issue.message);
  return {
    score: null,
    grade: null,
    categoryScores: null,
    triggeredRules: [],
    decisionReviews: [],
    summary: reasons.join(" "),
    conciseSummary: reasons[0] ?? "Invalid hand history.",
    whatWasGood: [],
    whatWasQuestionable: reasons,
    highestLeverageMistake: null,
    result: "Analysis skipped due to invalid hand history.",
    skippedReason:
      report.analysisDisposition === "partial"
        ? "Strategic analysis was only partially available."
        : report.analysisDisposition === "skipped"
          ? "Strategic analysis skipped because integrity checks failed."
          : null,
  };
}

function handBadge(report: HandImportReport, confidence: SessionReport["confidence"]): HandReview["badge"] {
  if (report.status !== "valid") return "Invalid";
  if (!report.strategicallyScorable) return "Skipped";
  if (confidence === "low") return "Low confidence";
  return "Valid";
}

export function reviewSession(parsed: ParseResult, mode: AnalysisMode): SessionReport {
  const { session, integrity } = parsed;
  const handReviews: HandReview[] = session.hands.map((hand) => {
    const report = integrity.handReports.find((item) => item.handId === hand.id) ?? integrity.handReports[0];
    if (!report || report.status !== "valid" || !report.strategicallyScorable) {
      const invalid = summarizeInvalidHand(report);
      return {
        handId: hand.id,
        handNumber: hand.handNumber,
        validity: report?.status ?? "unsupported",
        badge: handBadge(report, integrity.confidence),
        importReport: report,
        context: null,
        volatility: report?.issues.length ?? 0,
        ...invalid,
      };
    }

    const context = reconstructHand(hand);
    const decisionReviews = buildDecisionReviews(hand, context, mode);
    const categoryScores = buildCategoryScores(decisionReviews);
    const score = clamp(Math.round(average(Object.values(categoryScores))), 0, 100);
    const valid = summarizeValidHand(context, decisionReviews, score);
    return {
      handId: hand.id,
      handNumber: hand.handNumber,
      validity: report.status,
      badge: handBadge(report, integrity.confidence),
      importReport: report,
      context,
      volatility: Math.abs(70 - score) + decisionReviews.length,
      ...valid,
    };
  });

  const scoredHands = handReviews.filter((review) => review.score !== null);
  const overallScore = scoredHands.length ? Math.round(average(scoredHands.map((review) => review.score ?? 0))) : null;
  const overallGrade = overallScore !== null && integrity.confidence !== "low" ? alphaGrade(overallScore) : null;
  const categoryScores = CATEGORY_KEYS.reduce<Record<CategoryKey, number>>((scores, category) => {
    scores[category] = scoredHands.length ? Math.round(average(scoredHands.map((review) => review.categoryScores?.[category] ?? 0))) : 0;
    return scores;
  }, {} as Record<CategoryKey, number>);

  const allTriggers = scoredHands.flatMap((review) => review.triggeredRules);
  const triggerCounts = new Map<string, number>();
  for (const trigger of allTriggers.filter((trigger) => trigger.outcome !== "credit")) {
    triggerCounts.set(trigger.id, (triggerCounts.get(trigger.id) ?? 0) + 1);
  }
  const biggestStrategicLeakCategory = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topReviewedDecisions = scoredHands
    .flatMap((review) => review.decisionReviews)
    .filter((decision) => decision.scoreDelta > 0)
    .sort((a, b) => b.scoreDelta - a.scoreDelta)
    .slice(0, 3);
  const topCautionSpots = scoredHands
    .flatMap((review) => review.decisionReviews)
    .filter((decision) => decision.scoreDelta < 0)
    .sort((a, b) => a.scoreDelta - b.scoreDelta)
    .slice(0, 3);

  const recommendations: Recommendation[] = buildRecommendations(biggestStrategicLeakCategory, integrity.biggestEngineFaultCategory, integrity.confidence);
  const aggregateChipResult = session.hands.reduce((sum, hand) => sum + chipResultForHand(hand), 0);
  const strategicallyScoredChipResult = scoredHands.reduce((sum, review) => {
    const hand = session.hands.find((item) => item.id === review.handId);
    return sum + (hand ? chipResultForHand(hand) : 0);
  }, 0);
  const suppressOverallGrade = integrity.validHands === 0 || integrity.invalidHands > integrity.validHands;

  const quickSummary =
    integrity.confidence === "low"
      ? `${integrity.confidenceReason} ${integrity.mainFailureSource}`
      : overallScore === null
        ? "No valid hands were available for strategic grading."
        : `Scored ${scoredHands.length} valid hands. Session confidence: ${integrity.confidence}. Biggest strategic leak: ${biggestStrategicLeakCategory?.replaceAll("_", " ") ?? "none obvious"}.`;

  return {
    session,
    mode,
    overallScore: suppressOverallGrade ? null : overallScore,
    overallGrade: suppressOverallGrade ? null : overallGrade,
    confidence: integrity.confidence,
    confidenceLabel: `Session grade confidence: ${integrity.confidence}.`,
    quickSummary,
    categoryScores,
    handReviews,
    recommendations,
    sessionIntegrity: integrity,
    engineIssues: integrity.handReports.filter((report) => report.status !== "valid"),
    overview: {
      totalHands: integrity.totalHands,
      validHands: integrity.validHands,
      invalidHands: integrity.invalidHands,
      unscoredHands: integrity.unscoredHands,
      aggregateChipResult,
      strategicallyScoredChipResult,
      biggestStrategicLeakCategory,
      biggestEngineFaultCategory: integrity.biggestEngineFaultCategory,
      topReviewedDecisions,
      topCautionSpots,
    },
  };
}
