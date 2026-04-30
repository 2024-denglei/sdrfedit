# SDRF Editor

[![License](https://img.shields.io/github/license/bigbio/sdrfedit)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/bigbio/sdrfedit?style=social)](https://github.com/bigbio/sdrfedit/stargazers)
[![jsDelivr](https://data.jsdelivr.com/v1/package/gh/bigbio/sdrfedit/badge)](https://www.jsdelivr.com/package/gh/bigbio/sdrfedit)

Lightweight, self-hosted SDRF editing in the browser. `sdrfedit` helps create, edit, validate, and export Sample and Data Relationship Format files without requiring a backend.

## Highlights

- Browser-first SDRF editing with virtual scrolling for large tables
- Guided SDRF creation wizard for building files from scratch
- Ontology-aware cell editing with EBI OLS lookups
- Validation through the deployed PRIDE SDRF validator API, with optional local browser validation via Pyodide
- Optional AI-assisted recommendations for metadata cleanup and improvement
- TSV and Excel export

## Quick Start

```bash
npm install
ng serve
```

Open `http://localhost:4200`.

For a production build:

```bash
npm run build
```

## Validation

The editor supports two validation modes:

- `PRIDE API`: the default path, using the deployed SDRF validator service from PRIDE
- `Local browser`: runs `sdrf-pipelines` in the browser via Pyodide when users do not want to send the file out

The local validator bundle is loaded from `src/assets/wheels/`, and the Pyodide worker lives in `src/app/workers/pyodide.worker.ts`.

## AI Assistant

The AI assistant is optional. It can suggest fixes for validation errors and improve metadata quality using OpenAI, Anthropic, Google Gemini, or a local Ollama instance.

If you want stronger example-driven suggestions, you can build the local SDRF knowledge base:

```bash
git clone https://github.com/bigbio/sdrf-annotated-datasets.git
node scripts/build-sdrf-index.js ./sdrf-annotated-datasets/datasets
```

## Embedding

The editor bundle is committed to `dist/` and served directly from GitHub through jsDelivr.

```html
<!DOCTYPE html>
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/bigbio/sdrfedit@main/dist/sdrf-editor/browser/styles.css"
    >
  </head>
  <body>
    <app-root></app-root>

    <script
      src="https://cdn.jsdelivr.net/gh/bigbio/sdrfedit@main/dist/sdrf-editor/browser/polyfills.js"
      type="module"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/gh/bigbio/sdrfedit@main/dist/sdrf-editor/browser/main.js"
      type="module"
    ></script>
  </body>
</html>
```

After changing the app, rebuild and commit `dist/` so the CDN version updates.

## Project Structure

```text
src/
├── app/
│   ├── components/
│   ├── core/
│   └── workers/
├── assets/
└── index.html
```

Key areas:

- `src/app/components/sdrf-editor/`: main editor UI
- `src/app/components/sdrf-wizard/`: creation wizard
- `src/app/core/services/`: parsing, validation, export, AI, and cache services
- `src/app/workers/pyodide.worker.ts`: local validation worker

## Related Projects

- [SDRF specification website](https://sdrf.quantms.org)
- [proteomics-metadata-standard](https://github.com/bigbio/proteomics-metadata-standard)
- [sdrf-pipelines](https://github.com/bigbio/sdrf-pipelines)
- [sdrf-annotated-datasets](https://github.com/bigbio/sdrf-annotated-datasets)

## Contributing

```bash
git checkout -b feature/my-change
npm install
npm run build
```

Then commit your changes, include updated build artifacts when needed, and open a pull request.

## License

Apache License 2.0
