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
const promptSections = [
  ['subject', 'SUBJECT', '주제'],
  ['style', 'STYLE', '스타일'],
  ['background', 'BACKGROUND', '배경'],
  ['lighting_environment', 'LIGHTING & ENVIRONMENT', '조명 및 환경'],
  ['color_palette', 'COLOR PALETTE', '색상 팔레트'],
  ['composition', 'COMPOSITION', '구도'],
  ['camera', 'CAMERA', '카메라'],
  ['negative', 'NEGATIVE', '부정 요소']
];
const sectionProperties = Object.fromEntries(promptSections.flatMap(([key]) => [
  [key, { type: 'string', description: key === 'negative' ? 'English negative keywords, about 160-220 characters.' : 'Detailed production-ready English section, about 240-290 characters.' }],
  [`${key}_ko`, { type: 'string', description: 'Faithful and natural Korean version of the corresponding English section.' }]
]));
const sectionKeys = Object.keys(sectionProperties);

function composePrompt(result, language = 'en') {
  return promptSections.map(([key, englishTitle, koreanTitle]) => {
    const title = language === 'en' ? englishTitle : koreanTitle;
    const value = result[language === 'en' ? key : `${key}_ko`].trim();
    return `## ${title}\n${value}`;
  }).join('\n\n');
}

async function requestStructuredPrompt(apiKey, content, correction = '') {
  const systemText = `Create a production-ready GPT Image prompt as eight separate sections. Preserve the user's intent and expand missing visual details coherently. Each of the first seven English sections should be about 240-290 characters; the English negative section should be about 160-220 characters. The composed English result must total 2,000-2,500 characters including headings. Korean fields must faithfully translate their corresponding English fields. Do not place Markdown headings inside field values.${correction}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: openaiModel,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemText }] },
        { role: 'user', content }
      ],
      text: { format: { type: 'json_schema', name: 'gpt_image_prompt_sections', strict: true, schema: { type: 'object', properties: sectionProperties, required: sectionKeys, additionalProperties: false } } },
      max_output_tokens: 6000
    }),
    signal: AbortSignal.timeout(120000)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

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
    let { response, payload } = await requestStructuredPrompt(apiKey, content);
    if (!response.ok) {
      console.error('OpenAI API error:', response.status, payload?.error?.code || payload?.error?.type || 'unknown');
      const messages = { 401: 'OpenAI API 키가 유효하지 않습니다.', 429: 'OpenAI API 사용 한도 또는 결제 한도에 도달했습니다.' };
      return res.status(response.status).json({ ok: false, code: payload?.error?.code || 'OPENAI_ERROR', message: messages[response.status] || 'OpenAI 상세 프롬프트 생성에 실패했습니다.' });
    }
    let outputText = payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!outputText) return res.status(502).json({ ok: false, code: 'EMPTY_RESPONSE', message: 'OpenAI가 상세 프롬프트를 반환하지 않았습니다.' });
    let sections = JSON.parse(outputText);
    let finalPrompt = composePrompt(sections);
    if (finalPrompt.length < 2000 || finalPrompt.length > 2500) {
      ({ response, payload } = await requestStructuredPrompt(apiKey, content, ` Previous output composed to ${finalPrompt.length} characters, outside the required range. Correct the section detail so the composed English prompt is strictly 2,000-2,500 characters.`));
      if (!response.ok) return res.status(response.status).json({ ok: false, code: payload?.error?.code || 'OPENAI_ERROR', message: '프롬프트 길이 자동 보정에 실패했습니다.' });
      outputText = payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
      if (!outputText) return res.status(502).json({ ok: false, code: 'EMPTY_RESPONSE', message: 'OpenAI가 보정된 프롬프트를 반환하지 않았습니다.' });
      sections = JSON.parse(outputText);
      finalPrompt = composePrompt(sections);
    }
    if (finalPrompt.length < 2000 || finalPrompt.length > 2500) return res.status(502).json({ ok: false, code: 'INVALID_PROMPT_LENGTH', message: `생성된 영문 프롬프트가 ${finalPrompt.length.toLocaleString()}자로 허용 범위를 벗어났습니다. 다시 시도해 주세요.` });
    return res.json({ ok: true, result: { final_prompt: finalPrompt, final_prompt_ko: composePrompt(sections, 'ko'), negative_ko: sections.negative_ko.trim() }, model: openaiModel });
  } catch (error) {
    console.error('OpenAI request failed:', error?.name || error?.message || 'unknown');
    return res.status(502).json({ ok: false, code: 'OPENAI_UNAVAILABLE', message: 'OpenAI 서버에 연결하지 못했습니다.' });
  }
});

app.use((_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`GPT Image Prompt Maker running at http://localhost:${port}`));
}

export default app;
