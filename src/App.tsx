import { useMemo, useState } from "react";
import { allFixtures, parseSession, reportToJson, reportToMarkdown, reviewSession } from "./analysis";
import type { AnalysisMode, RawSession } from "./analysis";
import { HandReviewList } from "./ui/HandReviewList";
import { ImportPanel } from "./ui/ImportPanel";
import { ModeToggle } from "./ui/ModeToggle";
import { ScoreCard } from "./ui/ScoreCard";

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvSummary(report: ReturnType<typeof reviewSession>): string {
  const rows = [["handNumber", "validity", "score", "badge", "issues"]];
  for (const hand of report.handReviews) {
    rows.push([
      String(hand.handNumber),
      hand.validity,
      String(hand.score ?? ""),
      hand.badge,
      hand.importReport.issues.map((issue) => issue.code).join("|"),
    ]);
  }
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}

function decisionLabel(decision: NonNullable<ReturnType<typeof reviewSession>["overview"]["topReviewedDecisions"][number]>): string {
  return `${decision.heroAction}: ${decision.summary}`;
}

export default function App() {
  const [mode, setMode] = useState<AnalysisMode>("sound_fundamentals");
  const [rawSession, setRawSession] = useState<RawSession>(allFixtures.disciplinedSessionFixture);
  const [sourceLabel, setSourceLabel] = useState("disciplinedSessionFixture");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseSession(rawSession), [rawSession]);
  const report = useMemo(() => reviewSession(parsed, mode), [mode, parsed]);

  function handleImportText(text: string, source: string) {
    try {
      const parsedJson = JSON.parse(text) as RawSession;
      if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) throw new Error("Root JSON must be an object.");
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
            <h1>Integrity-First Session Analyzer</h1>
            <p className="muted lead">
              Strictly validates exported hand histories before any strategic review. Invalid hands are isolated as engine/export issues, not graded as poker decisions.
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
            <ScoreCard label="Session Integrity" score={report.overview.validHands} detail={`${report.overview.validHands}/${report.overview.totalHands} valid`} />
            <ScoreCard label="Strategic Score" score={report.overallScore ?? 0} detail={report.overallGrade ?? "Withheld"} muted={report.overallScore === null} />
            <ScoreCard label="Confidence" score={report.overview.invalidHands} detail={report.confidenceLabel} muted={report.confidence === "low"} />
            <ScoreCard
              label="Main Engine Fault"
              score={report.engineIssues.length}
              detail={report.overview.biggestEngineFaultCategory ?? "None"}
              muted={report.engineIssues.length > 0}
            />
          </div>

          <p className="summary-copy">{report.quickSummary}</p>
          <div className="warning-box">
            <p>{report.sessionIntegrity.confidenceReason}</p>
            <p>{report.sessionIntegrity.mainFailureSource}</p>
            {parsed.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>

        <section className="double-grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Session Integrity</h3>
            </div>
            <div className="score-grid">
              <ScoreCard label="Total Hands" score={report.overview.totalHands} />
              <ScoreCard label="Valid Hands" score={report.overview.validHands} />
              <ScoreCard label="Invalid Hands" score={report.overview.invalidHands} muted={report.overview.invalidHands > 0} />
              <ScoreCard label="Unscored Hands" score={report.overview.unscoredHands} muted={report.overview.unscoredHands > 0} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Strategic Review</h3>
            </div>
            <div className="recommendation-list">
              <article className="recommendation-item">
                <strong>Biggest strategic leak</strong>
                <p>{report.overview.biggestStrategicLeakCategory?.replaceAll("_", " ") ?? "None identified from valid hands."}</p>
              </article>
              <article className="recommendation-item">
                <strong>Scored chip result</strong>
                <p>{report.overview.strategicallyScoredChipResult}</p>
              </article>
              <article className="recommendation-item">
                <strong>Aggregate chip result</strong>
                <p>{report.overview.aggregateChipResult}</p>
              </article>
            </div>
          </section>
        </section>

        <section className="double-grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Engine / Export Issues</h3>
            </div>
            <div className="recommendation-list">
              {report.engineIssues.length ? (
                report.engineIssues.map((issue) => (
                  <article key={issue.handId} className="recommendation-item">
                    <div className="pattern-head">
                      <strong>Hand {issue.handNumber}</strong>
                      <span className="muted">{issue.status}</span>
                    </div>
                    <p>{issue.issues.map((item) => item.message).join(" ")}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No engine/export faults were detected.</p>
              )}
            </div>
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
        </section>

        <section className="double-grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Top Reviewed Decisions</h3>
            </div>
            <div className="recommendation-list">
              {report.overview.topReviewedDecisions.length ? (
                report.overview.topReviewedDecisions.map((decision) => (
                  <article key={`${decision.actionIndex}-${decision.heroAction}`} className="recommendation-item">
                    <strong>{decision.verdict.toUpperCase()}</strong>
                    <p>{decisionLabel(decision)}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No confident positive decisions were available.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Top Caution Spots</h3>
            </div>
            <div className="recommendation-list">
              {report.overview.topCautionSpots.length ? (
                report.overview.topCautionSpots.map((decision) => (
                  <article key={`${decision.actionIndex}-${decision.heroAction}`} className="recommendation-item">
                    <strong>{decision.verdict.toUpperCase()}</strong>
                    <p>{decisionLabel(decision)}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No caution spots were scored from valid hands.</p>
              )}
            </div>
          </section>
        </section>

        <HandReviewList hands={report.handReviews} />
      </main>
    </div>
  );
}
