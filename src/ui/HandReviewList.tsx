import { useMemo, useState } from "react";
import type { HandReview } from "../analysis/types";

interface HandReviewListProps {
  hands: HandReview[];
}

export function HandReviewList({ hands }: HandReviewListProps) {
  const [filter, setFilter] = useState<"all" | "worst" | "preflop" | "warning">("all");
  const [query, setQuery] = useState("");
  const [selectedHandId, setSelectedHandId] = useState<string | null>(hands[0]?.handId ?? null);

  const filteredHands = useMemo(() => {
    const normalizedQuery = query.trim();
    return hands.filter((hand) => {
      if (filter === "worst" && hand.score > 65) return false;
      if (filter === "preflop" && !hand.warningTags.some((tag) => tag.includes("preflop") || tag.includes("vpip") || tag.includes("defend"))) return false;
      if (filter === "warning" && hand.warningTags.length === 0 && hand.severeLeakTags.length === 0) return false;
      if (!normalizedQuery) return true;
      return hand.handNumber.toString().includes(normalizedQuery);
    });
  }, [filter, hands, query]);

  const selected = filteredHands.find((hand) => hand.handId === selectedHandId) ?? filteredHands[0] ?? null;

  return (
    <section className="panel hand-panel">
      <div className="panel-header split">
        <h3>Hand-by-Hand Review</h3>
        <div className="toolbar">
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hand #"
          />
          <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">All hands</option>
            <option value="worst">Worst only</option>
            <option value="preflop">Preflop leaks</option>
            <option value="warning">Leak-tagged</option>
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
              <strong>{hand.score}</strong>
            </button>
          ))}
        </div>

        <div className="hand-detail">
          {selected ? (
            <>
              <div className="detail-topline">
                <h4>Hand {selected.handNumber}</h4>
                <span className="badge">{selected.grade}</span>
              </div>
              <p className="muted">
                Hero cards: {selected.context.hand.heroHoleCards.join(" ")} | Villains:{" "}
                {selected.context.villains.map((seat) => `${seat.name} (${seat.archetype})`).join(", ") || "Unknown"}
              </p>
              <p>{selected.context.lineSummary}</p>
              <p>{selected.summary}</p>
              <div className="tag-row">
                {selected.positiveTags.map((tag) => (
                  <span key={tag} className="pill positive">
                    {tag}
                  </span>
                ))}
                {[...selected.warningTags, ...selected.severeLeakTags].map((tag) => (
                  <span key={tag} className="pill warning">
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="rationale-list">
                {selected.rationales.map((rationale) => (
                  <li key={rationale}>{rationale}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">No hands match the current filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
