import type { PatternSummary } from "../analysis/types";

interface PatternPanelProps {
  title: string;
  items: PatternSummary[];
  positive?: boolean;
}

export function PatternPanel({ title, items, positive = false }: PatternPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="pattern-list">
        {items.length ? (
          items.map((item) => (
            <article key={item.tag} className={positive ? "pattern-item positive" : "pattern-item"}>
              <div className="pattern-head">
                <strong>{item.tag.replaceAll("_", " ")}</strong>
                <span className={`severity ${item.severity}`}>{item.severity}</span>
              </div>
              <p>{item.explanation}</p>
              <p className="muted compact">Hands: {item.affectedHands.join(", ")}</p>
              {!positive && item.correction ? <p className="compact">{item.correction}</p> : null}
            </article>
          ))
        ) : (
          <p className="muted">No recurring patterns detected yet.</p>
        )}
      </div>
    </section>
  );
}
