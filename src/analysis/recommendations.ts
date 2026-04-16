import type { AnalysisMode, PatternSummary, Recommendation } from "./types";

const MODE_PREFIX: Record<AnalysisMode, string> = {
  sound_fundamentals: "In Sound Fundamentals mode,",
  adaptive_pressure: "In Adaptive Pressure mode,",
};

export function buildRecommendations(leaks: PatternSummary[], strengths: PatternSummary[], mode: AnalysisMode): Recommendation[] {
  const picks: Recommendation[] = leaks.slice(0, 5).map((leak) => ({
    key: leak.tag,
    priority: leak.severity === "high" ? "high" : leak.severity === "medium" ? "medium" : "low",
    text: `${MODE_PREFIX[mode]} ${leak.correction ?? leak.explanation}`,
    sourceTags: [leak.tag],
  }));

  if (mode === "adaptive_pressure" && !picks.some((item) => item.key === "pressure_vs_overfolder")) {
    picks.push({
      key: "adaptive-pressure-default",
      priority: "medium",
      text: "In Adaptive Pressure mode, pressure Nits and weak-tight lines more often when prior action shows capped weakness, but keep sticky profiles on a value-heavy plan.",
      sourceTags: ["pressure_vs_overfolder"],
    });
  }

  if (mode === "sound_fundamentals" && !picks.some((item) => item.key === "vpip_pfr_gap")) {
    picks.push({
      key: "sound-fundamentals-default",
      priority: "medium",
      text: "In Sound Fundamentals mode, cut speculative overcalls that do not win initiative or position cleanly.",
      sourceTags: ["vpip_pfr_gap"],
    });
  }

  if (strengths.some((strength) => strength.tag === "value_vs_caller")) {
    picks.push({
      key: "keep-value-plan",
      priority: "low",
      text: "Keep leaning into value against calling-heavy profiles; that pattern showed up as a repeat strength.",
      sourceTags: ["value_vs_caller"],
    });
  }

  return picks.slice(0, 6);
}
