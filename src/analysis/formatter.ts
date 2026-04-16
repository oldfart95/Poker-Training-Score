import { CATEGORY_LABELS } from "./constants";
import { formatPercent } from "./utils";
import type { SessionReport } from "./types";

export function reportToJson(report: SessionReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportToMarkdown(report: SessionReport): string {
  const lines: string[] = [];
  lines.push("# Session Analyzer Report");
  lines.push("");
  lines.push(`- Overall score: ${report.overallScore} (${report.overallGrade})`);
  lines.push(`- Philosophy: ${report.mode.replaceAll("_", " ")}`);
  lines.push(`- Total hands: ${report.overview.totalHands}`);
  lines.push(`- Biggest strength: ${report.overview.biggestStrength?.tag ?? "None"}`);
  lines.push(`- Biggest leak: ${report.overview.biggestLeak?.tag ?? "None"}`);
  lines.push("");
  lines.push("## Category Breakdown");
  for (const [key, score] of Object.entries(report.categoryScores)) {
    lines.push(`- ${CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}: ${formatPercent(score)}`);
  }
  lines.push("");
  lines.push("## Top Leaks");
  for (const leak of report.leaks.slice(0, 5)) {
    lines.push(`- ${leak.tag}: ${leak.explanation} (${leak.count} hands)`);
  }
  lines.push("");
  lines.push("## Recommendations");
  for (const recommendation of report.recommendations) {
    lines.push(`- ${recommendation.text}`);
  }
  return lines.join("\n");
}
