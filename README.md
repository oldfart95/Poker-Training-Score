# Poker Trainer Session Analyzer

Rules-based session analyzer for Pocket Pixel Poker / Poker Training Emulator exports. The app is fully static and can be deployed to GitHub Pages without a backend.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm test
npm run build
```

## GitHub Pages deployment

The repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

To enable hosting:

1. Push the repo to GitHub on the `main` branch.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `main` or run the workflow manually.

The Vite base path is resolved automatically from `GITHUB_REPOSITORY`, so the app works both for:

- user or org sites like `username.github.io`
- project sites like `username.github.io/repository-name/`

## Developer Notes

- Import is integrity-first. The app parses JSON safely, validates schema/session structure, validates every hand before scoring, and produces a per-hand import report.
- Hand validity classes are `valid`, `invalid_schema`, `invalid_sequence`, `invalid_accounting`, and `unsupported`.
- Invalid hands are treated as engine/export faults. They are excluded from strategic grading, excluded from aggregate strategic summaries, and surfaced in a separate engine issues section.
- Strategic scoring is rule-based only. No AI grading is used anywhere in the analyzer.
- Rule coverage includes opening range discipline by position, facing raise and 3-bet discipline, weak one-pair overplay, oversized-pot spew, disciplined folds, value/isolation aggression versus calling stations, caution versus nit-heavy lines, and wider bluff-catching against LAG/maniac profiles.
- Session confidence is based on the number and ratio of valid strategically scorable hands. Low-confidence sessions with mostly invalid hands withhold the clean overall grade.
