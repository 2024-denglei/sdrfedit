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
- Optional wizard AI assistant that annotates a PXD dataset or your own paper for you
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

There are two independent AI features, and both are optional.

### Editor recommendations (no backend)

Runs entirely in the browser with your own key for OpenAI, Anthropic, Google Gemini, or a
local Ollama instance. It suggests fixes for validation errors and improves metadata
quality on a table you already have open.

If you want stronger example-driven suggestions, build the local SDRF knowledge base:

```bash
git clone https://github.com/bigbio/sdrf-annotated-datasets.git
node scripts/build-sdrf-index.js ./sdrf-annotated-datasets/datasets
```

### Wizard assistant (needs the backend)

A chat panel docked beside **Create New SDRF** that fills the wizard in for you. It
covers three situations:

1. **You have a ProteomeXchange accession.** It fetches the PRIDE metadata and raw file
   list, finds the linked paper, reads its methods, and proposes values for the template
   layers, characteristics, instrument, enzyme, modifications, plex kit, and file
   assignment. For a paywalled paper it downloads and parses the PDF with MinerU, or asks
   you to upload it.
2. **You have a question about SDRF.** It answers from a vector index of
   [the specification](https://sdrf.quantms.org/specification.html) and cites the section
   it used.
3. **You have your own manuscript.** Upload the PDF or paste the methods text, and it
   proposes annotations the same way as case 1.

Every suggestion arrives as a card showing `current → proposed`, and nothing changes
until you click Apply. Ontology values are resolved through EBI OLS server-side, so the
model cannot invent an accession.

This feature needs a small FastAPI service because it downloads PDFs, calls MinerU, and
holds the LLM and embedding keys — none of which belong in a browser:

```bash
cd backend
uv venv .venv && uv pip install -r requirements.txt   # or python3 -m venv + pip
cp .env.example .env                                  # add LLM_API_KEY
python -m app.rag.build_index                         # build the specification index
uvicorn app.main:app --port 8000
```

The frontend probes `GET /api/health` when the wizard opens and only shows the panel when
the backend is reachable with an LLM configured. The backend URL comes from
`assistantBaseUrl` in `src/environments/environment.ts`; CDN-embedded deployments can
override it at runtime by setting `window.__SDRF_ASSISTANT_URL__` or the
`sdrf_assistant_url` key in `localStorage`. Add your frontend origin to `CORS_ORIGINS` in
`backend/.env`.

See [`backend/README.md`](backend/README.md) for the LLM, embedding, and MinerU
configuration options, and for how to swap the vector store or PDF parser.

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
├── environments/
└── index.html
backend/                 # optional wizard assistant service
├── app/
│   ├── llm/             # agent loop, prompts, streaming client
│   ├── parsing/         # MinerU backends behind one interface
│   ├── rag/             # specification chunking, embeddings, vector store
│   ├── routers/         # /api/chat, /api/uploads
│   └── tools/           # PRIDE, Europe PMC, OLS, templates, spec search
└── data/spec_index/     # generated knowledge base
```

Key areas:

- `src/app/components/sdrf-editor/`: main editor UI
- `src/app/components/sdrf-wizard/`: creation wizard
- `src/app/components/wizard-ai-panel/`: wizard assistant chat panel
- `src/app/core/services/`: parsing, validation, export, AI, and cache services
- `src/app/core/services/assistant/`: backend transport and the wizard action bridge
- `src/app/workers/pyodide.worker.ts`: local validation worker
- `backend/`: FastAPI service for the wizard assistant (see `backend/README.md`)

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
