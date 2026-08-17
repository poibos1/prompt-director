const FIELD_DEFS=[
  ['subject','주제'],['style','스타일'],['background','배경'],['lighting','조명 + 환경'],
  ['color','색감'],['composition','구도'],['camera','카메라'],['negative','부정 · Negative']
];
const RESULT_KEYS=['final_prompt','final_prompt_ko','negative_ko'];
const HISTORY_KEY='gpt-image-prompt-maker-history-v1';
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
  const pattern=/\n{0,2}(?:##\s*)?(?:부정|NEGATIVE|Negative)\s*\n[\s\S]*$/;
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
function renderResult(){
  el('englishTab').classList.toggle('active',currentLanguage==='en');el('koreanTab').classList.toggle('active',currentLanguage==='ko');
  const prompt=expandedResult?(currentLanguage==='en'?expandedResult.final_prompt:expandedResult.final_prompt_ko):'';
  el('output').textContent=prompt||'8개 항목을 짧게 입력한 뒤 상세 프롬프트를 생성하세요.';el('wordCount').textContent=currentLanguage==='en'?`${prompt.length.toLocaleString()}자 · 목표 2,250±250`:`${prompt.length.toLocaleString()}자`;
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

FIELD_DEFS.forEach(([key])=>el(key).addEventListener('input',()=>refreshRequestPreview(false)));
el('requestPreview').addEventListener('input',()=>{requestEdited=true});
el('referenceFiles').addEventListener('change',handleReferences);
refreshRequestPreview(true);renderHistory();renderResult();
