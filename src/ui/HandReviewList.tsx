import { useMemo, useState } from "react";
import type { HandReview } from "../analysis/types";

interface HandReviewListProps {
  hands: HandReview[];
}

type FilterKey = "all" | "valid" | "invalid" | "hero_losses" | "large_pots" | "preflop" | "flop" | "turn" | "river";

function matchesStreet(hand: HandReview, street: FilterKey): boolean {
  if (!["preflop", "flop", "turn", "river"].includes(street)) return true;
  return hand.decisionReviews.some((decision) => decision.street === street);
}

export function HandReviewList({ hands }: HandReviewListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selectedHandId, setSelectedHandId] = useState<string | null>(hands[0]?.handId ?? null);

  const filteredHands = useMemo(() => {
    const normalizedQuery = query.trim();
    return hands.filter((hand) => {
      if (filter === "valid" && hand.validity !== "valid") return false;
      if (filter === "invalid" && hand.validity === "valid") return false;
      if (filter === "hero_losses" && !hand.result.toLowerCase().includes("lost")) return false;
      if (filter === "large_pots" && (hand.context?.potSizeEstimate ?? 0) < 20) return false;
      if (["preflop", "flop", "turn", "river"].includes(filter) && !matchesStreet(hand, filter)) return false;
      if (!normalizedQuery) return true;
      return hand.handNumber.toString().includes(normalizedQuery);
    });
  }, [filter, hands, query]);

  const selected = filteredHands.find((hand) => hand.handId === selectedHandId) ?? filteredHands[0] ?? null;

  return (
    <section className="panel hand-panel">
      <div className="panel-header split">
        <h3>Hand List With Validity Badges</h3>
        <div className="toolbar">
          <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search hand #" />
          <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)}>
            <option value="all">All hands</option>
            <option value="valid">Only valid hands</option>
            <option value="invalid">Only invalid hands</option>
            <option value="hero_losses">Only hero losses</option>
            <option value="large_pots">Only large pots</option>
            <option value="preflop">Preflop</option>
            <option value="flop">Flop</option>
            <option value="turn">Turn</option>
            <option value="river">River</option>
          </select>
        </div>
      </div>

      <div className="hand-layout">
        <div className="hand-list">
          {filteredHands.map((hand) => (
            <button
              key={hand.handId}
              type="button"
              className={selected?.handId === hand.handId ? "hand-row active" : "hand-row"}
              onClick={() => setSelectedHandId(hand.handId)}
            >
              <span>Hand {hand.handNumber}</span>
              <span className={hand.validity === "valid" ? "pill positive" : "pill warning"}>{hand.badge}</span>
            </button>
          ))}
        </div>

        <div className="hand-detail">
          {selected ? (
            <>
              <div className="detail-topline">
                <h4>Hand {selected.handNumber}</h4>
                <span className={selected.validity === "valid" ? "badge" : "badge warning-badge"}>{selected.badge}</span>
              </div>
              {selected.context ? (
                <>
                  <p className="muted">
                    Hero position: {selected.context.heroPosition.toUpperCase()} | Player count: {selected.context.playerCount} | Opponent archetypes:{" "}
                    {selected.context.villains.map((seat) => seat.archetype).join(", ") || "Unknown"}
                  </p>
                  <p className="muted">
                    Preflop aggressor: {selected.context.preflopAggressor ?? "Unknown"} | Facing bet: {selected.context.facingBet} | SPR:{" "}
                    {selected.context.spr?.toFixed(2) ?? "n/a"}
                  </p>
                  <p>{selected.conciseSummary}</p>
                  <p>{selected.summary}</p>
                  <div className="tag-row">
                    {selected.triggeredRules.map((trigger) => (
                      <span key={`${trigger.id}-${trigger.explanation}`} className={trigger.outcome === "credit" ? "pill positive" : "pill warning"}>
                        {trigger.id}
                      </span>
                    ))}
                  </div>
                  <div className="recommendation-list">
                    <article className="recommendation-item">
                      <strong>What was good</strong>
                      <p>{selected.whatWasGood.length ? selected.whatWasGood.join(" ") : "No explicit credit rules fired."}</p>
                    </article>
                    <article className="recommendation-item">
                      <strong>What was questionable</strong>
                      <p>{selected.whatWasQuestionable.length ? selected.whatWasQuestionable.join(" ") : "No caution rules fired."}</p>
                    </article>
                    <article className="recommendation-item">
                      <strong>Highest-leverage mistake</strong>
                      <p>{selected.highestLeverageMistake ?? "None identified from the reviewed decision points."}</p>
                    </article>
                  </div>
                  <ul className="rationale-list">
                    {selected.decisionReviews.map((decision) => (
                      <li key={`${decision.actionIndex}-${decision.heroAction}`}>
                        {decision.heroAction} [{decision.verdict}]: {decision.summary}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="muted">Invalid hand history</p>
                  <p>{selected.summary}</p>
                  <p>
                    Break action index:{" "}
                    {selected.importReport.exactBreakActionIndex === null ? "unknown" : selected.importReport.exactBreakActionIndex}
                    {" | "}Analysis: {selected.importReport.analysisDisposition}
                  </p>
                  <ul className="rationale-list">
                    {selected.importReport.issues.map((issue) => (
                      <li key={`${issue.code}-${issue.actionIndex ?? "na"}`}>
                        {issue.message}
                        {typeof issue.actionIndex === "number" ? ` (action ${issue.actionIndex})` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="muted">No hands match the current filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
