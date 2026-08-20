# GPT Image Prompt Maker

## Product goal
Turn short user notes into detailed, production-ready GPT Image prompts through the server-side OpenAI Responses API, with a manual ChatGPT copy/import fallback.

## Required structure
- Support exactly eight input categories: subject, style, background, lighting and environment, color, composition, camera, and negative.
- Treat English as the authoritative final prompt and provide a faithful Korean version.
- Validate imported JSON before applying it.
- Keep API keys server-only and never expose them to browser code or logs.
- Keep reference images in browser memory only; never store their image data in history.
- Keep dependencies minimal and run `npm run check` before finishing code changes.
