# Brew Buddy

Coffee brewing recommendations from your bag specs. Optional online extraction and recipe generation via a chained set of open-model APIs.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Navigate the 4-step wizard: Coffee Details -> Equipment -> Flavor Focus -> Recipe.

## Online LLMs

The `/extract` endpoint reads a coffee bag label using online APIs:

- OCR: OCR.space Free OCR API.
- LLM structuring: Hugging Face first, then Groq, Together, and OpenRouter if configured.

The `/generate-recipe` endpoint uses the same online chain to produce a recipe tailored to your coffee, brewer, and flavor focus. The recipe request uses a balanced small model and a lower output budget to keep token use down.

No local model install is required. No database, account system, or image persistence.

## API Keys

OCR.space can run with its public test key `helloworld`, but you should register for a free OCR.space key for real use. The free OCR API currently documents a free tier with daily/IP limits and a 1 MB file limit.

Hugging Face requires a token for Inference Providers. Groq, Together, and OpenRouter are optional online fallbacks if you have their API keys.

PowerShell setup:

```powershell
setx OCR_SPACE_API_KEY "your-ocr-space-key"
setx HF_TOKEN "hf_your_token"
setx GROQ_API_KEY "your_groq_key"
setx TOGETHER_API_KEY "your_together_key"
setx OPENROUTER_API_KEY "your_openrouter_key"
```

Close and reopen PowerShell after `setx`.

## Run

```bash
npm run dev:all
```

Open http://localhost:5173.

The Camera / Upload Image button compresses the photo to about a 1024px long edge, hashes it with SHA-256, and POSTs it to `/extract`. Duplicate images in the same browser session skip the backend call. Recipe generation POSTs the edited coffee details and selected brew method to `/generate-recipe`. If OCR or the online LLM chain fails, the manual form remains usable.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OCR_SPACE_API_KEY` | `helloworld` | OCR.space free API key |
| `OCR_SPACE_ENGINE` | `2` | OCR.space OCR engine |
| `HF_TOKEN` | none | Hugging Face token for inference |
| `HF_MODEL` | `meta-llama/Llama-3.1-8B-Instruct:fastest` | Balanced open model used for OCR structuring and recipe generation |
| `HF_CHAT_URL` | `https://router.huggingface.co/v1/chat/completions` | Hugging Face chat completions endpoint |
| `GROQ_API_KEY` | none | Optional Groq API key for fallback generation |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq open-model fallback |
| `TOGETHER_API_KEY` | none | Optional Together API key for fallback generation |
| `TOGETHER_MODEL` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | Together open-model fallback |
| `OPENROUTER_API_KEY` | none | Optional OpenRouter API key for fallback generation |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.1-8b-instruct` | OpenRouter model fallback |
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

Recipe generation uses a chained set of online open-model APIs via the `/generate-recipe` endpoint. Extraction calls flow: client -> Vite proxy -> /extract -> OCR.space -> online LLM chain -> JSON -> editable client form.
