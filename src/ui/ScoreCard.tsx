interface ScoreCardProps {
  label: string;
  score: number;
  detail?: string;
}

export function ScoreCard({ label, score, detail }: ScoreCardProps) {
  return (
    <article className="score-card">
      <p className="score-label">{label}</p>
      <div className="score-value">{score}</div>
      {detail ? <p className="muted compact">{detail}</p> : null}
    </article>
  );
}
