# Prompt Director

Codex-ready V3 project for AI image/video prompt generation.

## Supported targets
- IMAGE: GPT Image, Nano Banana
- VIDEO: Seedance, Kling

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Add your `OPENAI_API_KEY` to `.env`.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Without an API key, the prompt builder still works, but **Analyze Uploaded Images** will return a configuration error.

## Codex
The repository contains `AGENTS.md` with the product rules Codex should preserve. Connect the GitHub repository to Codex Cloud and let Codex work from the repo root.

## Structure
- `public/index.html` — UI markup
- `src/styles.css` — styling
- `src/app.js` — client state and prompt engine
- `server.js` — static server + image-analysis API
- `AGENTS.md` — Codex project instructions
