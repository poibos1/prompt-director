const FIELD_DEFS=[
  ['subject','주제'],['style','스타일'],['background','배경'],['lighting','조명 + 환경'],
  ['color','색감'],['composition','구도'],['camera','카메라'],['negative','부정 · Negative']
];
const RESULT_KEYS=['final_prompt','final_prompt_ko','negative_ko'];
const HISTORY_KEY='gpt-image-prompt-maker-history-v1';
const TEST_PRESETS=[
  {
    subject:'붉은 우산을 든 여성 탐험가가 비 내리는 미래 도시의 골목을 걷는 장면',
    style:'시네마틱 사이버펑크, 사실적인 재질, 정교한 콘셉트 아트',
    background:'네온 간판과 높은 건물이 겹쳐진 도심 골목, 젖은 도로와 멀리 보이는 공중 열차',
    lighting:'늦은 밤, 차가운 네온광과 따뜻한 상점 조명, 안개 사이로 번지는 역광',
    color:'청록색과 자홍색 중심, 붉은 우산을 강조색으로 사용, 깊은 검정',
    composition:'세로 화면, 인물을 오른쪽 3분할 지점에 배치, 골목의 선이 깊은 원근감을 형성',
    camera:'35mm 렌즈, 눈높이보다 약간 낮은 앵글, 얕은 심도, 인물에 선명한 초점',
    negative:'왜곡된 손, 추가 손가락, 중복 인물, 흐린 얼굴, 글자, 로고, 워터마크'
  },
  {
    subject:'새벽 바닷가 절벽 위에서 거대한 흰 고래를 바라보는 어린 우주비행사',
    style:'몽환적인 판타지 일러스트, 부드러운 회화 질감, 섬세한 디테일',
    background:'별이 희미하게 남은 하늘, 잔잔한 바다와 절벽 아래 부서지는 파도',
    lighting:'해 뜨기 직전의 푸른 주변광, 수평선의 따뜻한 여명, 옅은 해무',
    color:'연한 파랑과 라벤더, 크림색 하이라이트, 낮은 채도의 파스텔 팔레트',
    composition:'넓은 가로 화면, 우주비행사는 왼쪽 아래에 작게, 고래는 화면 중앙을 가로지름',
    camera:'24mm 광각 렌즈, 약한 로우 앵글, 깊은 심도, 영화적인 와이드 숏',
    negative:'과도한 채도, 공포스러운 분위기, 잘린 고래, 왜곡된 인체, 텍스트, 로고'
  },
  {
    subject:'햇살 드는 오래된 서재에서 차를 내리는 주황색 고양이 바리스타',
    style:'따뜻한 스톱모션 애니메이션, 수공예 미니어처, 포근한 펠트 질감',
    background:'나무 책장, 작은 사다리, 낡은 책과 찻잔이 가득한 아늑한 서재',
    lighting:'오후 햇빛이 창문으로 비스듬히 들어오고 먼지 입자가 반짝이는 환경',
    color:'호박색, 짙은 갈색, 크림색, 차분한 올리브색의 따뜻한 조합',
    composition:'정사각형 화면, 고양이를 중앙에 배치하고 전경의 찻잔으로 깊이감 형성',
    camera:'50mm 렌즈, 눈높이 클로즈업, 부드러운 배경 흐림, 아날로그 필름 느낌',
    negative:'실사 인간, 플라스틱 질감, 추가 팔다리, 비대칭 눈, 글자, 로고, 워터마크'
  }
];
let expandedResult=null,currentLanguage='en',referenceImages=[],toastTimer=null,requestEdited=false;

function el(id){return document.getElementById(id)}
function value(id){return el(id).value.trim()}
function escapeHtml(text){return String(text).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function showToast(message,type='success'){const toast=el('toast');toast.textContent=message;toast.className=`toast show ${type}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.className='toast',2600)}

function inputSummary(){return FIELD_DEFS.map(([key,label])=>`- ${label}: ${value(key)||'미지정'}`).join('\n')}
function referenceSummary(){return referenceImages.length?referenceImages.map((item,index)=>`Ref ${String(index+1).padStart(2,'0')}: ${item.name}`).join('\n'):'참고 이미지 없음'}
function buildExpansionRequest(){
  return `당신은 GPT Image를 위한 시니어 아트 디렉터이자 이미지 프롬프트 작가입니다.

사용자가 짧게 작성한 내용을 단순히 반복하거나 동의어로 바꾸지 말고, 하나의 선명하고 제작 가능한 장면으로 창작·확장하세요. 명시된 의도는 반드시 유지하되, 비어 있는 항목은 전체 맥락에 어울리도록 구체적인 시각 정보로 보완하세요.

[사용자 입력]
${inputSummary()}

[참고 이미지]
${referenceSummary()}

[작성 원칙]
1. 주제: 인물·사물의 외형, 의상, 표정, 자세, 행동, 시선과 핵심 특징을 구체화합니다.
2. 스타일: 매체, 시대, 미술 방향, 사실성, 형태 언어와 렌더링 방식을 구체화합니다.
3. 배경: 장소, 건축, 전경·중경·후경 요소와 공간의 깊이를 묘사합니다.
4. 조명 + 환경: 날씨, 시간대, 공기, 입자, 지면 상태와 주변 현상에 맞춰 주광원·보조광의 위치, 방향, 세기, 색온도, 그림자와 반사를 함께 설계합니다.
5. 색감: 주조색·보조색·강조색, 채도, 대비와 색 조화를 지정합니다.
6. 구도: 피사체 배치, 시선 흐름, 균형, 레이어, 여백, 화면비와 초점을 설계합니다.
7. 카메라: 샷 크기, 앵글, 렌즈, 원근, 심도, 초점 거리와 촬영 특성을 지정합니다.
8. 부정: negative에는 사용자가 제외하려는 요소를 짧고 명확한 영어 네거티브 키워드로 변환하고 쉼표로 구분합니다. negative_ko에는 동일한 키워드를 빠짐없이 자연스러운 한국어로 작성합니다. 문장이나 설명을 붙이지 않습니다.
9. 추상적인 품질 표현만 나열하지 말고 눈에 보이는 요소로 설명합니다.
10. 참고 이미지가 있으면 Ref 번호로 구분해 보존할 특징과 참고할 특징을 명시합니다. 실제 인물의 신원은 추측하지 않습니다.
11. final_prompt는 GPT Image에 바로 붙여넣을 수 있도록 Subject, Style, Background, Lighting & Environment, Color, Composition, Camera, Negative 순서의 명확한 영문 섹션으로 구조화합니다.
12. final_prompt 영문 전체는 공백과 섹션 제목을 포함해 반드시 2,000~2,500자로 작성합니다. 목표는 2,250자입니다. 완성 후 문자 수를 직접 확인하고 허용 범위에 맞춘 뒤 JSON을 반환합니다. 문장을 중간에서 자르거나 사용자 입력 내용을 누락하지 말고, 중복 묘사는 한 번만 작성합니다.
13. final_prompt_ko는 final_prompt와 같은 내용을 빠짐없이 담은 자연스러운 한국어 버전으로 작성합니다. 마지막 부정 섹션은 반드시 "## 부정" 제목과 negative_ko의 한국어 키워드만 사용하며 영어 키워드를 남기지 않습니다.
14. 세부 항목을 JSON 필드로 반복하지 않습니다. 최종 결과 2개와 한국어 부정 키워드만 반환하여 중복 출력을 최소화합니다.

설명이나 마크다운 없이 다음 키를 모두 포함한 유효한 JSON만 반환하세요.
{
  "final_prompt": "",
  "final_prompt_ko": "",
  "negative_ko": ""
}`;
}
function refreshRequestPreview(force=false){if(!requestEdited||force){el('requestPreview').value=buildExpansionRequest();requestEdited=false}}
function resetRequestPreview(){refreshRequestPreview(true);showToast('현재 입력 내용으로 요청을 다시 만들었습니다.')}
async function copyExpansionRequest(){refreshRequestPreview(false);try{await navigator.clipboard.writeText(value('requestPreview'));showToast('상세화 요청을 복사했습니다.','success')}catch{showToast('클립보드 권한을 확인하세요.','error')}}
async function generateWithOpenAI(){
  const button=el('autoGenerateBtn'),status=el('apiStatus');refreshRequestPreview(false);
  button.disabled=true;button.textContent='상세 장면을 작성하고 있습니다…';status.className='message';status.textContent='OpenAI API가 입력 내용과 참고 이미지를 분석 중입니다.';
  try{
    const response=await fetch('/api/expand-prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:value('requestPreview'),images:referenceImages.map(({name,dataUrl})=>({name,dataUrl}))})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ok)throw new Error(payload.message||'상세 프롬프트 생성에 실패했습니다.');
    el('resultInput').value=JSON.stringify(payload.result,null,2);
    if(applyExpandedResult()===false)throw new Error('생성 결과가 검증을 통과하지 못했습니다. 수동 결과 영역의 안내를 확인하세요.');
    status.className='message success';status.textContent=`${payload.model}로 상세 프롬프트를 자동 생성하고 적용했습니다.`;
  }catch(error){status.className='message error';status.textContent=`${error.message} 아래 수동 ChatGPT 방식을 사용할 수 있습니다.`;showToast('자동 생성에 실패했습니다.','error')}
  finally{button.disabled=false;button.textContent='상세 프롬프트 자동 생성'}
}

function parseJson(raw){let text=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const first=text.indexOf('{'),last=text.lastIndexOf('}');if(first>=0&&last>first)text=text.slice(first,last+1);try{return {data:JSON.parse(text)}}catch(error){return {error:`JSON을 읽지 못했습니다: ${error.message}`}}}
function applyKoreanNegative(prompt,negativeKo){
  const section=`## 부정\n${negativeKo.trim()}`;
  const pattern=/\n{0,2}(?:##\s*)?(?:부정(?:\s*요소)?|NEGATIVE|Negative)\s*\n[\s\S]*$/;
  return pattern.test(prompt)?prompt.replace(pattern,`\n\n${section}`):`${prompt.trim()}\n\n${section}`;
}
function applyExpandedResult(){
  const box=el('validation');box.className='message';const raw=value('resultInput');
  if(!raw){box.classList.add('error');box.textContent='ChatGPT의 JSON 결과를 붙여넣으세요.';return false}
  const parsed=parseJson(raw);if(parsed.error){box.classList.add('error');box.textContent=`${parsed.error} ChatGPT 답변 전체를 다시 복사하거나 따옴표와 쉼표를 확인하세요.`;return false}
  const missing=RESULT_KEYS.filter(key=>typeof parsed.data?.[key]!=='string'||!parsed.data[key].trim());
  if(missing.length){box.classList.add('error');box.textContent=`비어 있거나 누락된 항목: ${missing.join(', ')}`;return false}
  const english=parsed.data.final_prompt.trim();
  const requiredSections=['SUBJECT','STYLE','BACKGROUND','LIGHTING & ENVIRONMENT','COLOR PALETTE','COMPOSITION','CAMERA','NEGATIVE'];
  const missingSections=requiredSections.filter(section=>!new RegExp(`^##\\s*${section.replace('&','\\&')}\\s*$`,'mi').test(english));
  if(missingSections.length){box.classList.add('error');box.textContent=`영문 프롬프트의 구조가 완전하지 않습니다. 누락된 섹션: ${missingSections.join(', ')}. 새 상세화 요청으로 다시 생성하세요.`;return false}
  if(english.length<2000||english.length>2500){box.classList.add('error');box.textContent=`영문 프롬프트가 ${english.length.toLocaleString()}자입니다. 2,000~2,500자 범위로 다시 생성해 달라고 요청하세요. 내용은 임의로 자르지 않았습니다.`;return false}
  expandedResult={...parsed.data,final_prompt:english,final_prompt_ko:applyKoreanNegative(parsed.data.final_prompt_ko,parsed.data.negative_ko)};currentLanguage='en';renderResult();saveHistory();box.classList.add('success');box.textContent=`3개 JSON 항목, 8개 섹션, 영문 ${expandedResult.final_prompt.length.toLocaleString()}자를 검증하고 적용했습니다.`;showToast('2,000~2,500자의 구조화된 프롬프트를 적용했습니다.','success');
  return true;
}
function setLanguage(language){currentLanguage=language;renderResult()}
const SECTION_LABELS={
  'SUBJECT':['주제','SUBJECT'],'주제':['주제','SUBJECT'],
  'STYLE':['스타일','STYLE'],'스타일':['스타일','STYLE'],
  'BACKGROUND':['배경','BACKGROUND'],'배경':['배경','BACKGROUND'],
  'LIGHTING & ENVIRONMENT':['조명 및 환경','LIGHTING & ENVIRONMENT'],'조명 및 환경':['조명 및 환경','LIGHTING & ENVIRONMENT'],
  'COLOR PALETTE':['색상 팔레트','COLOR PALETTE'],'색상 팔레트':['색상 팔레트','COLOR PALETTE'],
  'COMPOSITION':['구도','COMPOSITION'],'구도':['구도','COMPOSITION'],
  'CAMERA':['카메라','CAMERA'],'카메라':['카메라','CAMERA'],
  'NEGATIVE':['부정 요소','NEGATIVE'],'부정':['부정 요소','NEGATIVE'],'부정 요소':['부정 요소','NEGATIVE']
};
function splitPromptSections(prompt){
  const sections=[];
  const pattern=/^##\s+(.+?)\s*\n([\s\S]*?)(?=^##\s+|$)/gm;
  for(const match of prompt.matchAll(pattern))sections.push({title:match[1].trim(),content:match[2].trim()});
  return sections;
}
function renderSectionedPrompt(prompt){
  const output=el('output'),sections=splitPromptSections(prompt);
  if(!sections.length){output.classList.remove('sectioned');output.textContent=prompt;return}
  output.classList.add('sectioned');
  output.innerHTML=sections.map((section,index)=>{
    const [korean,english]=SECTION_LABELS[section.title]||[section.title,''];
    return `<article class="prompt-section"><div class="prompt-section-head"><span class="section-number">${String(index+1).padStart(2,'0')}</span><h3>${escapeHtml(korean)}${english?` <small>${escapeHtml(english)}</small>`:''}</h3></div><p>${escapeHtml(section.content)}</p></article>`;
  }).join('');
}
function renderResult(){
  el('englishTab').classList.toggle('active',currentLanguage==='en');el('koreanTab').classList.toggle('active',currentLanguage==='ko');
  const prompt=expandedResult?(currentLanguage==='en'?expandedResult.final_prompt:expandedResult.final_prompt_ko):'';
  if(prompt)renderSectionedPrompt(prompt);else{el('output').classList.remove('sectioned');el('output').textContent='8개 항목을 짧게 입력한 뒤 상세 프롬프트를 생성하세요.'}el('wordCount').textContent=currentLanguage==='en'?`${prompt.length.toLocaleString()}자 · 목표 2,250±250`:`${prompt.length.toLocaleString()}자`;
}
async function copyOutput(){if(!expandedResult){showToast('먼저 상세 프롬프트를 적용하세요.','warn');return}const text=currentLanguage==='en'?expandedResult.final_prompt:expandedResult.final_prompt_ko;try{await navigator.clipboard.writeText(text);showToast('프롬프트를 복사했습니다.')}catch{showToast('클립보드 권한을 확인하세요.','error')}}
function downloadOutput(){if(!expandedResult)return;const text=currentLanguage==='en'?expandedResult.final_prompt:expandedResult.final_prompt_ko;const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));link.download=`gpt-image-prompt-${currentLanguage}.txt`;link.click();URL.revokeObjectURL(link.href)}

function readHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return []}}
function saveHistory(){const items=readHistory();items.unshift({id:Date.now(),createdAt:new Date().toISOString(),result:expandedResult});localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,12)));renderHistory()}
function renderHistory(){const host=el('history'),items=readHistory();if(!items.length){host.innerHTML='<p class="empty">저장된 프롬프트가 없습니다.</p>';return}host.innerHTML=items.map(item=>`<article class="history-item"><button onclick="restoreHistory(${item.id})"><span>${new Date(item.createdAt).toLocaleString()}</span>${escapeHtml(item.result?.final_prompt_ko||item.result?.final_prompt||'').slice(0,90)}</button><button class="delete" aria-label="삭제" onclick="deleteHistory(${item.id})">×</button></article>`).join('')}
function restoreHistory(id){const item=readHistory().find(entry=>entry.id===id);if(!item)return;expandedResult=item.result;currentLanguage='en';renderResult();showToast('저장된 프롬프트를 불러왔습니다.')}
function deleteHistory(id){localStorage.setItem(HISTORY_KEY,JSON.stringify(readHistory().filter(item=>item.id!==id)));renderHistory()}
function clearHistory(){localStorage.removeItem(HISTORY_KEY);renderHistory();showToast('기록을 모두 삭제했습니다.')}

function compressReference(file,maxDimension=1024){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,maxDimension/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.82))};image.src=reader.result};reader.readAsDataURL(file)})}
async function handleReferences(event){referenceImages=[];const files=[...event.target.files].slice(0,2);for(const file of files)referenceImages.push({name:file.name,dataUrl:await compressReference(file)});renderReferences();refreshRequestPreview(true);if(event.target.files.length>2)showToast('비용 절감을 위해 참고 이미지는 최대 2장만 사용합니다.','warn');event.target.value=''}
function renderReferences(){el('references').innerHTML=referenceImages.map((item,index)=>`<figure><img src="${item.dataUrl}" alt="${escapeHtml(item.name)}"><figcaption>Ref ${String(index+1).padStart(2,'0')}</figcaption><button aria-label="참고 이미지 삭제" onclick="removeReference(${index})">×</button></figure>`).join('')}
function removeReference(index){referenceImages.splice(index,1);renderReferences();refreshRequestPreview(true)}

function fillQuickTest(){
  const preset=TEST_PRESETS[Math.floor(Math.random()*TEST_PRESETS.length)];
  FIELD_DEFS.forEach(([key])=>{el(key).value=preset[key]});
  requestEdited=false;
  refreshRequestPreview(true);
  showToast('임시 테스트 내용을 입력했습니다.');
}

const THEME_KEY='gpt-image-prompt-maker-theme';
function applyTheme(theme){
  const isLight=theme==='light',button=el('themeToggle');
  document.documentElement.dataset.theme=isLight?'light':'dark';
  button.setAttribute('aria-pressed',String(isLight));
  button.setAttribute('aria-label',isLight?'어두운 화면으로 전환':'밝은 화면으로 전환');
  button.querySelector('.theme-icon').textContent=isLight?'☾':'☀';
  button.querySelector('.theme-label').textContent=isLight?'어두운 화면':'밝은 화면';
}
function toggleTheme(){
  const next=document.documentElement.dataset.theme==='light'?'dark':'light';
  localStorage.setItem(THEME_KEY,next);
  applyTheme(next);
}

FIELD_DEFS.forEach(([key])=>el(key).addEventListener('input',()=>refreshRequestPreview(false)));
el('requestPreview').addEventListener('input',()=>{requestEdited=true});
el('referenceFiles').addEventListener('change',handleReferences);
el('themeToggle').addEventListener('click',toggleTheme);
el('quickTestBtn').addEventListener('click',fillQuickTest);
applyTheme(document.documentElement.dataset.theme);refreshRequestPreview(true);renderHistory();renderResult();
