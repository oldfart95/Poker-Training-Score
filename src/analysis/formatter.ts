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
  lines.push(`- Confidence: ${report.confidence}`);
  lines.push(`- Total hands: ${report.overview.totalHands}`);
  lines.push(`- Valid hands: ${report.overview.validHands}`);
  lines.push(`- Invalid hands: ${report.overview.invalidHands}`);
  lines.push(`- Unscored hands: ${report.overview.unscoredHands}`);
  lines.push(`- Overall score: ${report.overallScore ?? "withheld"}`);
  lines.push(`- Overall grade: ${report.overallGrade ?? "withheld due to low confidence"}`);
  lines.push(`- Strategic chip result: ${report.overview.strategicallyScoredChipResult}`);
  lines.push(`- Aggregate chip result: ${report.overview.aggregateChipResult}`);
  lines.push("");
  lines.push("## Session Integrity");
  lines.push(`- ${report.sessionIntegrity.confidenceReason}`);
  lines.push(`- ${report.sessionIntegrity.mainFailureSource}`);
  lines.push(`- Biggest engine fault: ${report.overview.biggestEngineFaultCategory ?? "None"}`);
  if (report.sessionIntegrity.unsupportedFields.length) {
    lines.push(`- Unsupported fields: ${report.sessionIntegrity.unsupportedFields.join(", ")}`);
  }
  lines.push("");
  lines.push("## Strategic Breakdown");
  for (const [key, score] of Object.entries(report.categoryScores)) {
    lines.push(`- ${CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}: ${formatPercent(score)}`);
  }
  lines.push("");
  lines.push("## Engine / Export Issues");
  for (const issue of report.engineIssues) {
    lines.push(`- Hand ${issue.handNumber}: ${issue.issues.map((item) => item.message).join(" | ")}`);
  }
  lines.push("");
  lines.push("## Recommendations");
  for (const recommendation of report.recommendations) {
    lines.push(`- ${recommendation.text}`);
  }
  return lines.join("\n");
}
