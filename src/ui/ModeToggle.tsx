import type { AnalysisMode } from "../analysis";

interface ModeToggleProps {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      {[
        ["sound_fundamentals", "Sound Fundamentals"],
        ["adaptive_pressure", "Adaptive Pressure"],
      ].map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          className={value === mode ? "mode-button active" : "mode-button"}
          onClick={() => onChange(mode as AnalysisMode)}
        >
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
