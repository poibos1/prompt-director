# AGENTS.md — Prompt Director

## Product goal
Prompt Director is a compact web app that converts a user's creative intent and reference images into production-oriented prompts for exactly four target models:
- Image: GPT Image, Nano Banana
- Video: Seedance, Kling

## Non-negotiable behavior
- Keep IMAGE and VIDEO state completely separate.
- IMAGE must expose GPT Image and Nano Banana prompt formats.
- VIDEO must expose Seedance and Kling prompt formats.
- GENERATE PROMPT always produces English first.
- The 한/영 번역 control toggles display between English and Korean without destroying the English source.
- Reference image analysis must feed composition, camera, pose, lighting, color, materials, style, preservation, and suggested reference roles into prompt generation.
- Never expose API keys in browser code. Image analysis is server-side only.
- Prefer stable mobile Safari behavior; avoid fragile dynamic select replacement logic.

## Development priorities
1. Correct mode/model switching.
2. Reliable prompt generation and format tabs.
3. Reliable image upload/analysis.
4. Clear reference priority controls.
5. Prompt inspector and contradiction detection.
6. UI polish only after behavior is stable.

## Coding rules
- Preserve existing user-facing functionality unless the task explicitly changes it.
- Keep dependencies minimal.
- Run `npm run check` before finishing a code task.
- For UI changes, verify both IMAGE and VIDEO flows.
- Do not add new AI target models unless explicitly requested.
