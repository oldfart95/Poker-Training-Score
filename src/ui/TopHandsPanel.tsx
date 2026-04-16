import type { HandReview } from "../analysis/types";

interface TopHandsPanelProps {
  title: string;
  hands: HandReview[];
}

export function TopHandsPanel({ title, hands }: TopHandsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="mini-list">
        {hands.map((hand) => (
          <article key={`${title}-${hand.handId}`} className="mini-item">
            <div className="mini-top">
              <strong>Hand {hand.handNumber}</strong>
              <span>{hand.score}</span>
            </div>
            <p className="compact">{hand.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
