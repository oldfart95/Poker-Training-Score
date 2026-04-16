import { useRef, useState } from "react";

interface ImportPanelProps {
  onImportText: (text: string, source: string) => void;
  onLoadFixture: (fixture: string) => void;
}

export function ImportPanel({ onImportText, onLoadFixture }: ImportPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function importFile(file: File) {
    const text = await file.text();
    onImportText(text, file.name);
  }

  return (
    <section className="panel import-panel">
      <div>
        <p className="eyebrow">Session Import</p>
        <h2>Drop exported session JSON</h2>
        <p className="muted">
          Fully local analysis. No AI calls, no cloud upload, just deterministic rule review over the exported action history.
        </p>
      </div>

      <div
        className={dragActive ? "dropzone active" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) await importFile(file);
        }}
      >
        <p>Drag a `.json` export here</p>
        <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await importFile(file);
          }}
        />
      </div>

      <div className="fixture-row">
        <span className="muted">Quick fixtures:</span>
        <button type="button" className="chip-button" onClick={() => onLoadFixture("disciplinedSessionFixture")}>
          Disciplined
        </button>
        <button type="button" className="chip-button" onClick={() => onLoadFixture("loosePassiveFixture")}>
          Loose-Passive
        </button>
        <button type="button" className="chip-button" onClick={() => onLoadFixture("recklessAdaptiveFixture")}>
          Reckless Pressure
        </button>
        <button type="button" className="chip-button" onClick={() => onLoadFixture("strongExploitFixture")}>
          Strong Exploit
        </button>
      </div>
    </section>
  );
}
