import type { ConfidenceLevel, Recommendation } from "./types";

export function buildRecommendations(leakCategory: string | null, engineFault: string | null, confidence: ConfidenceLevel): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (engineFault) {
    recommendations.push({
      key: "engine-first",
      priority: "high",
      text: `Fix engine/export issue "${engineFault}" before trusting strategic trends from this session.`,
      sourceTags: [engineFault],
    });
  }

  if (leakCategory) {
    recommendations.push({
      key: "strategic-focus",
      priority: confidence === "low" ? "medium" : "high",
      text: `Primary strategic review target: ${leakCategory.replaceAll("_", " ")}.`,
      sourceTags: [leakCategory],
    });
  }

  if (confidence === "low") {
    recommendations.push({
      key: "low-confidence",
      priority: "high",
      text: "Session grade confidence is low because too many hands were invalid or unsupported for strategic review.",
      sourceTags: ["low_confidence"],
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      key: "clean-session",
      priority: "low",
      text: "Integrity checks were clean enough that the reviewed decisions are materially trustworthy.",
      sourceTags: ["clean_integrity"],
    });
  }

  return recommendations.slice(0, 4);
}
