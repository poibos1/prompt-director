import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '35mb' }));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, apiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 4) : [];
    if (!images.length) return res.status(400).json({ error: 'No images provided.' });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content = [
      {
        type: 'input_text',
        text: `Analyze the uploaded reference image(s) for an AI image/video prompt workflow. Return ONLY valid JSON with these keys: summary, composition, camera, pose, lighting, color, materials, style, preservation, suggested_reference_roles. Be concise but production-useful. When multiple images are provided, distinguish Ref 01, Ref 02, etc. Do not identify real people.`,
      },
      ...images.map((image_url) => ({ type: 'input_image', image_url, detail: 'high' })),
    ];

    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5',
      input: [{ role: 'user', content }],
    });

    const raw = (response.output_text || '').trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let analysis;
    try { analysis = JSON.parse(cleaned); }
    catch { analysis = { summary: raw }; }
    res.json({ analysis });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'Image analysis failed.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Prompt Director running at http://localhost:${port}`);
});
