import { MODE_WEIGHTS } from "./constants";
import { clamp } from "./utils";
import type { AnalysisMode, CategoryKey, HandContext, ScoreImpact } from "./types";

function pushImpact(
  impacts: ScoreImpact[],
  category: CategoryKey,
  delta: number,
  rationale: string,
  extras?: Pick<ScoreImpact, "tags" | "warnings" | "severeLeaks">,
): void {
  impacts.push({ category, delta, rationale, ...extras });
}

function evaluateBaseRules(context: HandContext): ScoreImpact[] {
  const impacts: ScoreImpact[] = [];
  const { heroPreflopBucket, heroPosition, postflopBucket, dominantVillainArchetype, flags, boardTexture } = context;

  if (["premium_pair", "strong_pair", "premium_broadway", "strong_broadway", "suited_ace", "suited_connector"].includes(heroPreflopBucket)) {
    pushImpact(impacts, "preflopDiscipline", 7, "Hero entered with a structurally playable preflop bucket.", { tags: ["disciplined_entry"] });
  }

  if (heroPreflopBucket === "offsuit_trash" && (flags.coldCalledPreflop || flags.openedPreflop)) {
    pushImpact(impacts, "preflopDiscipline", -16, "Hero put money in preflop with offsuit trash.", {
      warnings: ["loose_preflop_entry"],
      severeLeaks: ["loose_preflop_entry"],
    });
  }

  if (heroPreflopBucket === "weak_suited_trash" && flags.coldCalledPreflop) {
    pushImpact(impacts, "preflopDiscipline", -10, "Hero flatted suited trash rather than preserving discipline.", {
      warnings: ["passive_preflop_flat"],
    });
  }

  if (flags.coldCalledPreflop && ["premium_pair", "strong_pair", "premium_broadway", "strong_broadway"].includes(heroPreflopBucket)) {
    pushImpact(impacts, "initiative", -8, "Hero flatted a hand class that often prefers raise-or-fold discipline.", {
      warnings: ["passive_preflop_flat"],
    });
  }

  if (flags.openedPreflop || flags.threeBet) {
    pushImpact(impacts, "initiative", 8, "Hero took initiative instead of drifting into a reactive line.", {
      tags: ["initiative_used_well"],
    });
  }

  if (heroPosition === "btn" || heroPosition === "co") {
    pushImpact(impacts, "positionUse", 4, "Hero started from late position where pressure and control improve.", {
      tags: ["controlled_aggression_in_position"],
    });
  }

  if ((heroPosition === "sb" || heroPosition === "bb") && heroPreflopBucket === "offsuit_trash" && flags.coldCalledPreflop) {
    pushImpact(impacts, "positionUse", -10, "Hero defended weak offsuit trash from the blinds.", {
      warnings: ["blind_overdefend"],
    });
  }

  if (dominantVillainArchetype.name === "Calling Station" && flags.barreledMultipleStreets && ["air", "draw"].includes(postflopBucket)) {
    pushImpact(impacts, "archetypeAdjustment", -18, "Hero kept pressuring a sticky target without enough value.", {
      warnings: ["bad_target_bluff", "sticky_target_overbluff"],
      severeLeaks: ["sticky_target_overbluff"],
    });
  }

  if (dominantVillainArchetype.name === "Calling Station" && ["two_pair", "set", "straight", "flush", "strong_made_hand", "near_nut_hand"].includes(postflopBucket)) {
    pushImpact(impacts, "valueShowdown", 10, "Hero reached a value-heavy node against a target that pays off too often.", {
      tags: ["value_vs_caller"],
    });
  }

  if (dominantVillainArchetype.name === "Nit" && flags.barreledMultipleStreets && ["air", "draw", "weak_showdown"].includes(postflopBucket)) {
    pushImpact(impacts, "archetypeAdjustment", 8, "Hero applied pressure to a fold-prone target.", {
      tags: ["pressure_vs_overfolder"],
    });
  }

  if (flags.isolatedLimpers && (dominantVillainArchetype.name === "Nit" || dominantVillainArchetype.name === "Calling Station")) {
    pushImpact(impacts, "archetypeAdjustment", 6, "Hero isolated a player archetype that rewards initiative.", {
      tags: ["correct_isolation"],
    });
  }

  if (postflopBucket === "air" && flags.shoved) {
    pushImpact(impacts, "riskControl", -18, "Hero committed maximum risk with an empty hand class.", {
      warnings: ["spewy_all_in"],
      severeLeaks: ["spewy_all_in"],
    });
  }

  if (["set", "straight", "flush", "strong_made_hand", "near_nut_hand"].includes(postflopBucket) && context.heroPassiveActions > context.heroAggressiveActions) {
    pushImpact(impacts, "valueShowdown", -12, "Hero under-applied pressure with a strong made hand.", {
      warnings: ["missed_value"],
    });
  }

  if (["draw", "combo_draw"].includes(postflopBucket) && flags.barreledMultipleStreets && boardTexture.primary === "wet") {
    pushImpact(impacts, "coherence", 5, "Hero kept telling a believable high-equity pressure story.", {
      tags: ["coherent_double_barrel"],
    });
  }

  if (context.heroPassiveActions >= 2 && context.villainAggressionFaced >= 2 && ["air", "weak_showdown"].includes(postflopBucket)) {
    pushImpact(impacts, "riskControl", -11, "Hero chased too many streets with fragile showdown prospects.", {
      warnings: ["showdown_chasing", "unjustified_hero_call"],
    });
  }

  if (context.heroAggressiveActions > 0 && context.heroPassiveActions > context.heroAggressiveActions + 1) {
    pushImpact(impacts, "coherence", -7, "Hero line shifted between pressure and passivity without a clean story.", {
      warnings: ["incoherent_barrel"],
    });
  }

  if (context.heroAggressiveActions > 1 && context.potSizeEstimate > 0 && context.heroInvested / context.potSizeEstimate > 0.9) {
    pushImpact(impacts, "sizing", -8, "Sizing escalated to pot-committing levels without obvious stack leverage.", {
      warnings: ["sizing_mismatch"],
    });
  }

  if (context.heroWentToShowdown && context.heroWon && ["weak_showdown", "top_pair_good_kicker", "overpair"].includes(postflopBucket)) {
    pushImpact(impacts, "riskControl", 5, "Hero reached showdown with manageable risk and real equity.", {
      tags: ["strong_risk_control"],
    });
  }

  if (!flags.openedPreflop && !flags.coldCalledPreflop) {
    pushImpact(impacts, "preflopDiscipline", 4, "Hero avoided marginal preflop entry spots.", {
      tags: ["disciplined_fold"],
    });
  }

  return impacts;
}

function applyModeRules(context: HandContext, mode: AnalysisMode, impacts: ScoreImpact[]): ScoreImpact[] {
  const next = [...impacts];
  const { dominantVillainArchetype, heroPreflopBucket, flags, postflopBucket } = context;

  if (mode === "sound_fundamentals") {
    if (flags.coldCalledPreflop && ["suited_connector", "suited_gapper", "weak_suited_trash"].includes(heroPreflopBucket)) {
      pushImpact(next, "preflopDiscipline", -7, "Sound Fundamentals discounts speculative flats that lack clear initiative.", {
        warnings: ["vpip_pfr_gap"],
      });
    }
    if (dominantVillainArchetype.name === "Calling Station" && context.heroAggressiveActions >= 2 && ["weak_showdown", "air"].includes(postflopBucket)) {
      pushImpact(next, "archetypeAdjustment", -8, "Sound Fundamentals heavily penalizes bluffing into sticky profiles.", {
        warnings: ["bad_target_bluff"],
      });
    }
  }

  if (mode === "adaptive_pressure") {
    if (dominantVillainArchetype.foldTendency >= 0.7 && flags.barreledMultipleStreets && ["air", "draw", "weak_showdown"].includes(postflopBucket)) {
      pushImpact(next, "archetypeAdjustment", 10, "Adaptive Pressure rewards credible pressure against overfolders.", {
        tags: ["pressure_vs_overfolder"],
      });
    }
    if (dominantVillainArchetype.name === "Calling Station" && ["two_pair", "set", "straight", "flush", "strong_made_hand", "near_nut_hand"].includes(postflopBucket) && context.heroAggressiveActions >= 2) {
      pushImpact(next, "valueShowdown", 7, "Adaptive Pressure rewards widening value against sticky opponents.", {
        tags: ["value_vs_caller"],
      });
    }
    if (flags.openedPreflop && dominantVillainArchetype.name !== "Unknown") {
      pushImpact(next, "initiative", 4, "Adaptive Pressure gives extra credit for targeted initiative over passive drift.", {
        tags: ["initiative_used_well"],
      });
    }
  }

  if (flags.shoved && heroPreflopBucket === "offsuit_trash") {
    pushImpact(next, "riskControl", -12, "No philosophy excuses maximum aggression with garbage inventory.", {
      warnings: ["pressure_without_target"],
      severeLeaks: ["pressure_without_target"],
    });
  }

  return next;
}

export function scoreCategory(baseScore: number, impacts: ScoreImpact[], category: CategoryKey, mode: AnalysisMode): number {
  const weight = MODE_WEIGHTS[mode][category];
  const delta = impacts.filter((impact) => impact.category === category).reduce((sum, impact) => sum + impact.delta * weight, 0);
  return clamp(baseScore + delta, 0, 100);
}

export function evaluateRules(context: HandContext, mode: AnalysisMode): ScoreImpact[] {
  const baseImpacts = evaluateBaseRules(context);
  return applyModeRules(context, mode, baseImpacts);
}
