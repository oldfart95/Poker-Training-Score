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
