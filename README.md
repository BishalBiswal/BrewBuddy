# Brew Buddy

Coffee brewing recommendations from your bag specs. Deterministic recipe engine plus optional online free-tier extraction and LLM-powered recipe generation via Hugging Face.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Navigate the 4-step wizard: Coffee Details -> Equipment -> Flavor Focus -> Recipe.

## Phase 2: Online Free API Extraction & Recipe Generation (optional)

The `/extract` endpoint reads a coffee bag label using online free-tier APIs:

- OCR: OCR.space Free OCR API.
- LLM structuring: Hugging Face Inference Providers with an open model.

The `/generate-recipe` endpoint uses Hugging Face to produce a recipe tailored to your coffee, brewer, and flavor focus, with a deterministic fallback if the LLM is unavailable.

No local model install is required. No database, account system, or image persistence.

### API Keys

OCR.space can run with its public test key `helloworld`, but you should register for a free OCR.space key for real use. The free OCR API currently documents a free tier with daily/IP limits and a 1 MB file limit.

Hugging Face requires a free account token for Inference Providers.

PowerShell setup:

```powershell
setx OCR_SPACE_API_KEY "your-ocr-space-key"
setx HF_TOKEN "hf_your_token"
```

Close and reopen PowerShell after `setx`.

### Run

```bash
npm run dev:all
```

Open http://localhost:5173.

The Camera / Upload Image button compresses the photo to about a 1024px long edge, hashes it with SHA-256, and POSTs it to `/extract`. Duplicate images in the same browser session skip the backend call. Recipe generation POSTs the edited coffee details and selected brew method to `/generate-recipe`. If OCR or the online LLM fails, the manual form and rule-based recipe fallback remain usable.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OCR_SPACE_API_KEY` | `helloworld` | OCR.space free API key |
| `OCR_SPACE_ENGINE` | `2` | OCR.space OCR engine |
| `HF_TOKEN` | none | Hugging Face token for free-tier inference |
| `HF_MODEL` | `meta-llama/Llama-3.3-70B-Instruct:fastest` | Open model used for OCR structuring and recipe generation |
| `HF_CHAT_URL` | `https://router.huggingface.co/v1/chat/completions` | Hugging Face chat completions endpoint |
| `EXTRACT_PORT` | `3001` | Backend port |

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server only |
| `npm run dev:frontend` | Vite dev server |
| `npm run dev:backend` | Online OCR/LLM extract backend on port 3001 |
| `npm run dev:all` | Frontend and backend together |
| `npm run build` | Production build |
| `npm test` | Run Vitest suite |
| `npm run preview` | Preview production build |

## Architecture

Recipe generation optionally uses the Hugging Face online LLM via the `/generate-recipe` endpoint, falling back to client-side deterministic pure functions over static JSON data. Extraction calls flow: client -> Vite proxy -> /extract -> OCR.space -> Hugging Face -> JSON -> editable client form.




