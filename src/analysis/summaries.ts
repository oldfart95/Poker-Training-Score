import type { AnalysisMode, HandReview, PatternSummary } from "./types";

const LEAK_EXPLANATIONS: Record<string, { explanation: string; correction: string }> = {
  loose_preflop_entry: {
    explanation: "Hero entered too many low-quality pots before equity or position justified it.",
    correction: "Trim offsuit trash and weak suited entries unless there is a clear exploit target and position edge.",
  },
  passive_preflop_flat: {
    explanation: "Strong or playable hands were flatted instead of taking initiative or folding.",
    correction: "Raise more often with playable hands rather than drifting into passive calls.",
  },
  vpip_pfr_gap: {
    explanation: "The session shows too much entry relative to initiative.",
    correction: "Narrow cold-call frequency and convert more playable continues into raises.",
  },
  blind_overdefend: {
    explanation: "Hero defended too much junk from out-of-position blind seats.",
    correction: "Defend more selectively from the blinds when the hand bucket is weak and the opener is sticky.",
  },
  bad_target_bluff: {
    explanation: "Bluffs were directed at profiles that do not fold often enough.",
    correction: "Reduce bluff volume versus Calling Station style opponents and reallocate aggression to fold-prone targets.",
  },
  sticky_target_overbluff: {
    explanation: "Repeated pressure into sticky archetypes created negative-EV barrels.",
    correction: "Prefer thinner value and fewer air barrels against showdown-bound opponents.",
  },
  missed_value: {
    explanation: "Strong made hands were not pushed hard enough for value.",
    correction: "Bet and raise more decisively when strong made hands face calling-heavy opponents.",
  },
  incoherent_barrel: {
    explanation: "Hero's line shifted between passive and aggressive actions without a stable story.",
    correction: "Plan pressure hands one street earlier and avoid random give-up or random re-acceleration lines.",
  },
  unjustified_hero_call: {
    explanation: "Hero paid off too often with weak showdown value.",
    correction: "Fold more weak catchers once the line lacks blocker logic or archetype support.",
  },
  spewy_all_in: {
    explanation: "All-in decisions exceeded what the hand class and context supported.",
    correction: "Reserve stacks for strong value, robust draws, or well-supported exploit spots.",
  },
  pressure_without_target: {
    explanation: "Aggression was applied without a fold-prone target or credible story.",
    correction: "Only accelerate pressure when stack, board, and villain profile all point the same way.",
  },
  sizing_mismatch: {
    explanation: "Sizing choices did not match stack leverage, hand class, or target tendencies.",
    correction: "Use larger sizes for value into sticky profiles and cleaner pressure sizes into capped folders.",
  },
  showdown_chasing: {
    explanation: "Hero continued too long just to realize weak showdown value.",
    correction: "Give up earlier when equity and archetype context do not support a bluff-catch.",
  },
};

const STRENGTH_EXPLANATIONS: Record<string, string> = {
  disciplined_fold: "Hero consistently avoided thin or junk preflop continues.",
  correct_isolation: "Hero picked profitable isolation spots against weaker profiles.",
  value_vs_caller: "Hero found profitable value lines against sticky opponents.",
  pressure_vs_overfolder: "Hero pressured archetypes that actually surrender to heat.",
  coherent_double_barrel: "Hero maintained believable pressure across dynamic boards.",
  strong_risk_control: "Hero protected stack depth when marginal showdowns were enough.",
  initiative_used_well: "Hero claimed initiative rather than defaulting to passive lines.",
  controlled_aggression_in_position: "Hero used position to control aggression rather than spewing.",
};

function buildPattern(tag: string, hands: HandReview[], severity: "low" | "medium" | "high", mode: AnalysisMode, positive = false): PatternSummary {
  const info = LEAK_EXPLANATIONS[tag];
  return {
    tag,
    severity,
    count: hands.length,
    affectedHands: hands.map((hand) => hand.handNumber),
    explanation: positive ? STRENGTH_EXPLANATIONS[tag] ?? `${tag} appeared repeatedly in ${mode.replaceAll("_", " ")} mode.` : info?.explanation ?? `${tag} repeated across the session.`,
    correction: positive ? undefined : info?.correction,
  };
}

export function detectLeaksAndStrengths(handReviews: HandReview[], mode: AnalysisMode): {
  leaks: PatternSummary[];
  strengths: PatternSummary[];
} {
  const leakMap = new Map<string, HandReview[]>();
  const strengthMap = new Map<string, HandReview[]>();

  for (const review of handReviews) {
    for (const tag of [...review.warningTags, ...review.severeLeakTags]) {
      leakMap.set(tag, [...(leakMap.get(tag) ?? []), review]);
    }
    for (const tag of review.positiveTags) {
      strengthMap.set(tag, [...(strengthMap.get(tag) ?? []), review]);
    }
  }

  const leaks = [...leakMap.entries()]
    .map(([tag, hands]) => buildPattern(tag, hands, hands.length >= 3 ? "high" : hands.length === 2 ? "medium" : "low", mode))
    .sort((a, b) => b.count - a.count || (a.severity < b.severity ? 1 : -1));

  const strengths = [...strengthMap.entries()]
    .map(([tag, hands]) => buildPattern(tag, hands, hands.length >= 3 ? "high" : hands.length === 2 ? "medium" : "low", mode, true))
    .sort((a, b) => b.count - a.count);

  return { leaks, strengths };
}
