import { CATEGORY_KEYS } from "./constants";
import { buildRecommendations } from "./recommendations";
import { reconstructHand } from "./reconstructor";
import { evaluateRules, scoreCategory } from "./rules";
import { detectLeaksAndStrengths } from "./summaries";
import { alphaGrade, average, clamp, softBucket, unique } from "./utils";
import type { AnalysisMode, CategoryKey, HandReview, Session, SessionReport } from "./types";

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

function summarizeHand(review: HandReview): string {
  const positives = review.positiveTags.slice(0, 2).join(", ");
  const leaks = review.severeLeakTags.concat(review.warningTags).slice(0, 2).join(", ");
  if (positives && leaks) return `Mixed result: ${positives}, but ${leaks} dragged the score down.`;
  if (positives) return `Positive execution through ${positives}.`;
  if (leaks) return `Primary issue: ${leaks}.`;
  return "Neutral hand with limited leverage either way.";
}

function computeVolatility(review: HandReview): number {
  return review.severeLeakTags.length * 10 + review.positiveTags.length * 5 + Math.abs(review.score - 70);
}

export function reviewSession(session: Session, mode: AnalysisMode): SessionReport {
  const handReviews: HandReview[] = session.hands.map((hand) => {
    const context = reconstructHand(hand);
    const impacts = evaluateRules(context, mode);
    const base = baselineCategoryScores();
    const categoryScores = CATEGORY_KEYS.reduce<Record<CategoryKey, number>>((scores, category) => {
      scores[category] = scoreCategory(base[category], impacts, category, mode);
      return scores;
    }, {} as Record<CategoryKey, number>);
    const score = clamp(Math.round(average(Object.values(categoryScores))), 0, 100);
    const positiveTags = unique(impacts.flatMap((impact) => impact.tags ?? []));
    const warningTags = unique(impacts.flatMap((impact) => impact.warnings ?? []));
    const severeLeakTags = unique(impacts.flatMap((impact) => impact.severeLeaks ?? []));
    const review: HandReview = {
      handId: hand.id,
      handNumber: hand.handNumber,
      score,
      grade: `${alphaGrade(score)} / ${softBucket(score)}`,
      categoryScores,
      positiveTags,
      warningTags,
      severeLeakTags,
      rationales: impacts.map((impact) => impact.rationale),
      summary: "",
      volatility: 0,
      context,
    };
    review.summary = summarizeHand(review);
    review.volatility = computeVolatility(review);
    return review;
  });

  const categoryScores = CATEGORY_KEYS.reduce<Record<CategoryKey, number>>((scores, category) => {
    scores[category] = Math.round(average(handReviews.map((review) => review.categoryScores[category])));
    return scores;
  }, {} as Record<CategoryKey, number>);

  const overallScore = Math.round(average(handReviews.map((review) => review.score)));
  const { leaks, strengths } = detectLeaksAndStrengths(handReviews, mode);
  const recommendations = buildRecommendations(leaks, strengths, mode);
  const overallGrade = `${alphaGrade(overallScore)} / ${softBucket(overallScore)}`;
  const biggestStrength = strengths[0] ?? null;
  const biggestLeak = leaks[0] ?? null;

  return {
    session,
    mode,
    overallScore,
    overallGrade,
    quickSummary:
      biggestLeak && biggestStrength
        ? `Session leaned ${softBucket(overallScore).toLowerCase()}: best pattern was ${biggestStrength.tag.replaceAll("_", " ")}, while the main drag was ${biggestLeak.tag.replaceAll("_", " ")}.`
        : `Session scored ${overallScore} with ${handReviews.length} reviewed hands.`,
    categoryScores,
    handReviews,
    leaks,
    strengths,
    recommendations,
    overview: {
      totalHands: session.hands.length,
      biggestStrength,
      biggestLeak,
      topRecurringIssue: biggestLeak,
      topRecurringPositive: biggestStrength,
    },
    topHands: {
      best: [...handReviews].sort((a, b) => b.score - a.score).slice(0, 5),
      worst: [...handReviews].sort((a, b) => a.score - b.score).slice(0, 5),
      weirdest: [...handReviews].sort((a, b) => b.volatility - a.volatility).slice(0, 5),
    },
  };
}
