import { useMemo, useState } from "react";
import { allFixtures, parseSession, reportToJson, reportToMarkdown, reviewSession } from "./analysis";
import { CATEGORY_LABELS } from "./analysis/constants";
import type { AnalysisMode, RawSession, SessionReport } from "./analysis";
import { HandReviewList } from "./ui/HandReviewList";
import { ImportPanel } from "./ui/ImportPanel";
import { ModeToggle } from "./ui/ModeToggle";
import { PatternPanel } from "./ui/PatternPanel";
import { ScoreCard } from "./ui/ScoreCard";
import { TopHandsPanel } from "./ui/TopHandsPanel";

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvSummary(report: SessionReport): string {
  const rows = [["handNumber", "score", "grade", "positives", "warnings"]];
  for (const hand of report.handReviews) {
    rows.push([
      String(hand.handNumber),
      String(hand.score),
      hand.grade,
      hand.positiveTags.join("|"),
      [...hand.warningTags, ...hand.severeLeakTags].join("|"),
    ]);
  }
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}

export default function App() {
  const [mode, setMode] = useState<AnalysisMode>("sound_fundamentals");
  const [rawSession, setRawSession] = useState<RawSession>(allFixtures.disciplinedSessionFixture);
  const [sourceLabel, setSourceLabel] = useState("disciplinedSessionFixture");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseSession(rawSession), [rawSession]);
  const report = useMemo(() => reviewSession(parsed.session, mode), [mode, parsed.session]);

  function handleImportText(text: string, source: string) {
    try {
      const parsedJson = JSON.parse(text) as RawSession;
      if (!parsedJson || typeof parsedJson !== "object") throw new Error("Root JSON must be an object.");
      setRawSession(parsedJson);
      setSourceLabel(source);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid JSON file.");
    }
  }

  function handleFixtureLoad(fixtureName: string) {
    setRawSession(allFixtures[fixtureName as keyof typeof allFixtures]);
    setSourceLabel(fixtureName);
    setError(null);
  }

  return (
    <div className="app-shell">
      <div className="backdrop" />
      <main className="app">
        <header className="hero">
          <div>
            <p className="eyebrow">Pocket Pixel Poker</p>
            <h1>Rules-Based Session Analyzer</h1>
            <p className="muted lead">
              Deterministic, explainable review for exported emulator sessions. Weighted rules, archetype-aware scoring, and philosophy-specific feedback with zero AI dependency.
            </p>
          </div>
          <ModeToggle value={mode} onChange={setMode} />
        </header>

        <ImportPanel onImportText={handleImportText} onLoadFixture={handleFixtureLoad} />

        {error ? <section className="panel error-panel">{error}</section> : null}

        <section className="panel overview-panel">
          <div className="panel-header split">
            <div>
              <p className="eyebrow">Session Overview</p>
              <h2>{sourceLabel}</h2>
            </div>
            <div className="toolbar">
              <button type="button" className="secondary-button" onClick={() => downloadText("session-report.json", reportToJson(report), "application/json")}>
                Export JSON
              </button>
              <button type="button" className="secondary-button" onClick={() => downloadText("session-report.csv", csvSummary(report), "text/csv")}>
                Export CSV
              </button>
              <button type="button" className="secondary-button" onClick={() => downloadText("session-report.md", reportToMarkdown(report), "text/markdown")}>
                Export Markdown
              </button>
            </div>
          </div>

          <div className="overview-grid">
            <ScoreCard label="Overall Score" score={report.overallScore} detail={report.overallGrade} />
            <ScoreCard label="Philosophy" score={report.overview.totalHands} detail={mode.replaceAll("_", " ")} />
            <ScoreCard label="Biggest Strength" score={report.overview.biggestStrength?.count ?? 0} detail={report.overview.biggestStrength?.tag ?? "None"} />
            <ScoreCard label="Biggest Leak" score={report.overview.biggestLeak?.count ?? 0} detail={report.overview.biggestLeak?.tag ?? "None"} />
          </div>

          <p className="summary-copy">{report.quickSummary}</p>
          {parsed.warnings.length ? (
            <div className="warning-box">
              {parsed.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="score-grid">
          {Object.entries(report.categoryScores).map(([key, score]) => (
            <ScoreCard key={key} label={CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]} score={score} />
          ))}
        </section>

        <section className="double-grid">
          <PatternPanel title="Recurring Leaks" items={report.leaks} />
          <PatternPanel title="Recurring Strengths" items={report.strengths} positive />
        </section>

        <section className="triple-grid">
          <TopHandsPanel title="Best Played Hands" hands={report.topHands.best} />
          <TopHandsPanel title="Worst Played Hands" hands={report.topHands.worst} />
          <TopHandsPanel title="Weirdest Hands" hands={report.topHands.weirdest} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Recommendations</h3>
          </div>
          <div className="recommendation-list">
            {report.recommendations.map((item) => (
              <article key={item.key} className="recommendation-item">
                <div className="pattern-head">
                  <strong>{item.priority.toUpperCase()}</strong>
                  <span className="muted">{item.sourceTags.join(", ")}</span>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <HandReviewList hands={report.handReviews} />
      </main>
    </div>
  );
}
