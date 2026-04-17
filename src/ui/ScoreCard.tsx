interface ScoreCardProps {
  label: string;
  score: number;
  detail?: string;
  muted?: boolean;
}

export function ScoreCard({ label, score, detail, muted = false }: ScoreCardProps) {
  return (
    <article className={muted ? "score-card muted-card" : "score-card"}>
      <p className="score-label">{label}</p>
      <div className="score-value">{score}</div>
      {detail ? <p className="muted compact">{detail}</p> : null}
    </article>
  );
}
