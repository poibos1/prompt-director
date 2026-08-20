# GPT Image Prompt Maker

GPT Image 전용 프롬프트 제작 도구입니다. 주제, 스타일, 배경, 조명 + 환경, 색감, 구도, 카메라, 부정을 짧게 입력한 뒤 ChatGPT용 상세화 요청을 복사하고, 반환된 JSON을 적용해 영문·한국어 완성 프롬프트를 만듭니다.

OpenAI API를 연결하면 ChatGPT 창을 열지 않고 상세 프롬프트를 자동 생성합니다. API 키는 서버의 `.env`에만 저장하고 브라우저에는 노출하지 않습니다. 수동 ChatGPT 복사·붙여넣기 방식도 예비 수단으로 유지됩니다.

```env
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.4-nano
```

```bash
npm install
npm start
```

기본 주소: `http://localhost:3001`
