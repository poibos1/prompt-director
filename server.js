import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadLocalEnv();
const app = express();
const port = process.env.PORT || 3001;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.4-nano';
const resultProperties = {
  final_prompt: { type: 'string' }, final_prompt_ko: { type: 'string' }, negative_ko: { type: 'string' }
};

app.use(express.json({ limit: '40mb' }));
app.use('/src', express.static(__dirname));
app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, workflow: 'openai-api-with-copy-fallback', openaiConfigured: Boolean(process.env.OPENAI_API_KEY), model: openaiModel });
});

app.post('/api/expand-prompt', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, code: 'OPENAI_NOT_CONFIGURED', message: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 2) : [];
  if (!prompt) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: '상세화 요청 내용이 비어 있습니다.' });

  const content = [{ type: 'input_text', text: prompt }];
  for (const image of images) {
    if (typeof image?.dataUrl !== 'string' || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image.dataUrl)) return res.status(400).json({ ok: false, code: 'INVALID_IMAGE', message: '지원하지 않는 참고 이미지가 포함되어 있습니다.' });
    if (image.dataUrl.length > 4_500_000) return res.status(413).json({ ok: false, code: 'IMAGE_TOO_LARGE', message: '압축된 참고 이미지 한 장은 약 3MB 이하여야 합니다.' });
    content.push({ type: 'input_image', image_url: image.dataUrl });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: 'gpt_image_prompt', strict: true, schema: { type: 'object', properties: resultProperties, required: Object.keys(resultProperties), additionalProperties: false } } },
        max_output_tokens: 6000
      }),
      signal: AbortSignal.timeout(120000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI API error:', response.status, payload?.error?.code || payload?.error?.type || 'unknown');
      const messages = { 401: 'OpenAI API 키가 유효하지 않습니다.', 429: 'OpenAI API 사용 한도 또는 결제 한도에 도달했습니다.' };
      return res.status(response.status).json({ ok: false, code: payload?.error?.code || 'OPENAI_ERROR', message: messages[response.status] || 'OpenAI 상세 프롬프트 생성에 실패했습니다.' });
    }
    const outputText = payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!outputText) return res.status(502).json({ ok: false, code: 'EMPTY_RESPONSE', message: 'OpenAI가 상세 프롬프트를 반환하지 않았습니다.' });
    return res.json({ ok: true, result: JSON.parse(outputText), model: openaiModel });
  } catch (error) {
    console.error('OpenAI request failed:', error?.name || error?.message || 'unknown');
    return res.status(502).json({ ok: false, code: 'OPENAI_UNAVAILABLE', message: 'OpenAI 서버에 연결하지 못했습니다.' });
  }
});

app.use((_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(port, () => console.log(`GPT Image Prompt Maker running at http://localhost:${port}`));
