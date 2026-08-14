let mode='VIDEO', currentPrompt='', uploadedImages=[], imageAnalysis=null, promptVariants={}, promptVariantsKo={}, activeFormat='Seedance', outputLanguage='EN';
const structures={
 'GPT Image':['Reference Priority','Image Analysis','Composition','Subject','Environment','Camera','Lighting','Materials / Style','Constraints'],
 'Nano Banana':['Reference Priority','Image Analysis','Subject / Scene','Composition','Camera','Lighting','Materials / Style','Edit / Preservation Rules','Constraints'],
 'Seedance':['Reference','Image Analysis','Scene','Character Action','Camera','Environment Motion','Lighting','Effects','Constraints'],
 'Kling':['Reference Lock','Image Analysis','Subject','Action','Camera','Environment','Lighting','Motion','Negative Constraints']
};
const formats={IMAGE:['GPT Image','Nano Banana'],VIDEO:['Seedance','Kling']};
function el(id){return document.getElementById(id)} function val(id){return el(id).value}
function currentModel(){return mode==='IMAGE'?val('imageModel'):val('videoModel')}
function setMode(m){
  if(m!=='IMAGE' && m!=='VIDEO') return;
  mode=m;
  const isImage=m==='IMAGE';
  el('imageModeBtn').classList.toggle('active-mode',isImage);
  el('videoModeBtn').classList.toggle('active-mode',!isImage);
  el('imageModelWrap').style.display=isImage?'block':'none';
  el('videoModelWrap').style.display=isImage?'none':'block';
  el('videoControls').style.display=isImage?'none':'grid';
  activeFormat=isImage?val('imageModel'):val('videoModel');
  renderFormatTabs();
  updateBadge();
}
function selectModel(expectedMode){
  if(mode!==expectedMode) setMode(expectedMode);
  activeFormat=currentModel();
  renderFormatTabs();
  updateBadge();
}
function updateBadge(){
  const model=currentModel() || formats[mode][0];
  el('modeBadge').textContent=`${mode} · ${model.toUpperCase()}`;
  el('modeDebug').textContent=`${mode} · ${model}`;
  if(Object.keys(promptVariants).length && promptVariants[model] && activeFormat===model){ refreshOutput(); }
}
function renderFormatTabs(){
  const host=el('formatTabs');
  if(!host) return;
  host.innerHTML='';
  formats[mode].forEach(name=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='format-tab'+(name===activeFormat?' active':'');
    b.textContent=name+' Prompt';
    b.onclick=()=>showFormat(name);
    host.appendChild(b);
  });
}
function showFormat(name){
  if(!formats[mode].includes(name)) return;
  activeFormat=name;
  if(mode==='IMAGE') el('imageModel').value=name; else el('videoModel').value=name;
  renderFormatTabs();
  updateBadge();
  refreshOutput();
}
function refreshOutput(){
  const source=outputLanguage==='KO'?promptVariantsKo:promptVariants;
  currentPrompt=source[activeFormat]||'';
  el('output').textContent=currentPrompt||`Press GENERATE PROMPT to create the ${activeFormat} prompt.`;
  el('translateBtn').textContent=outputLanguage==='EN'?'한/영 번역 · 한국어 보기':'한/영 번역 · English 보기';
}
function toggleLanguage(){
  outputLanguage=outputLanguage==='EN'?'KO':'EN';
  refreshOutput();
}
function syncVal(id){el(id+'v').textContent=val(id)+'%'}
function line(k,v){return v?`## ${k}\n${v}\n`:''}
function analysisText(){if(!imageAnalysis)return 'No machine analysis available. Follow the manually assigned reference roles and priorities.'; const a=imageAnalysis;return [a.summary,a.composition&&`Composition: ${a.composition}`,a.camera&&`Camera: ${a.camera}`,a.pose&&`Pose/subjects: ${a.pose}`,a.lighting&&`Lighting: ${a.lighting}`,a.color&&`Color: ${a.color}`,a.materials&&`Materials: ${a.materials}`,a.style&&`Style: ${a.style}`,a.preservation&&`Preserve: ${a.preservation}`].filter(Boolean).join('\n')}
function buildPromptFor(model){
 const brief=val('brief').trim();
 const roles=val('refRoles').trim();
 const refs=`Reference priority: Ref01 ${val('r1')}%, Ref02 ${val('r2')}%, Ref03 ${val('r3')}%, Ref04 ${val('r4')}%. ${roles||'The highest-weight reference is authoritative. Do not inherit conflicting pose, camera, identity, lighting, or composition from lower-priority references.'}`;
 const camera=`Use ${val('camera')} with ${val('lens')}. ${val('shot')} shot, ${val('angle')}. Camera behavior: ${mode==='VIDEO'?val('move'):'match the selected composition and lens perspective consistently'}.`;
 const lighting=`${val('temp')} lighting with ${val('contrast').toLowerCase()}. Backlight ${val('backlight')}%, bloom ${val('bloom')}%, volumetric rays ${val('volume')}%. Keep all light and shadow directions physically coherent.`;
 const motion=mode==='VIDEO'
   ? `Pose preservation ${val('pose')}%. Character motion ${val('charMotion')}%. Environment motion ${val('envMotion')}%. VFX ${val('vfx')}%. Avoid pose drift, identity drift, camera drift, and background deformation.`
   : `Pose preservation ${val('pose')}%. Keep the still-image composition, anatomy, identity, and reference structure stable.`;
 const style=val('style').trim()||'High-quality cinematic visual direction with coherent materials and controlled detail.';
 const negative=val('negative').trim()||'No anatomy errors, extra fingers or limbs, duplicated objects, unwanted camera changes, pose reinterpretation, inconsistent lighting, or accidental reference mixing.';
 const analysis=analysisText();
 const scene=brief||'Use the uploaded reference analysis as the main scene description.';
 const map={'Reference':refs,'Reference Lock':refs,'Reference Priority':refs,'Image Analysis':analysis,'Scene':scene,'Subject':scene,'Subject / Scene':scene,'Composition':scene,'Character Action':scene,'Action':scene,'Camera':camera,'Lighting':lighting,'Environment Motion':motion,'Motion':motion,'Effects':motion,'Environment':style,'Materials / Style':style,'Edit / Preservation Rules':`Preserve reference identity, structure, pose, layout and camera according to the assigned priorities. Pose preservation strength: ${val('pose')}%.`,'Constraints':negative,'Negative Constraints':negative};
 return `MODEL: ${model}\nMODE: ${mode}\n\n`+structures[model].map(s=>line(s,map[s])).join('\n');
}
function buildPromptForKorean(model){
 const brief=val('brief').trim();
 const roles=val('refRoles').trim();
 const refs=`레퍼런스 우선순위: Ref01 ${val('r1')}%, Ref02 ${val('r2')}%, Ref03 ${val('r3')}%, Ref04 ${val('r4')}%. ${roles||'가중치가 가장 높은 레퍼런스를 절대 기준으로 사용합니다. 낮은 우선순위 레퍼런스에서 충돌하는 포즈, 카메라, 캐릭터 정체성, 조명, 구도를 가져오지 마십시오.'}`;
 const camera=`${val('camera')}와 ${val('lens')}를 사용합니다. ${val('shot')} 샷, ${val('angle')}. 카메라 동작: ${mode==='VIDEO'?val('move'):'선택된 구도와 렌즈 원근을 일관되게 유지합니다'}.`;
 const lighting=`${val('temp')} 조명, ${val('contrast')}. 역광 ${val('backlight')}%, 블룸 ${val('bloom')}%, 볼류메트릭 레이 ${val('volume')}%. 모든 빛과 그림자 방향은 물리적으로 일관되게 유지합니다.`;
 const motion=mode==='VIDEO'
   ? `포즈 유지 ${val('pose')}%. 캐릭터 모션 ${val('charMotion')}%. 환경 모션 ${val('envMotion')}%. VFX ${val('vfx')}%. 포즈 드리프트, 캐릭터 정체성 변화, 카메라 드리프트, 배경 변형을 피하십시오.`
   : `포즈 유지 ${val('pose')}%. 정지 이미지의 구도, 해부학, 캐릭터 정체성, 레퍼런스 구조를 안정적으로 유지합니다.`;
 const style=val('style').trim()||'재질과 디테일이 일관된 고품질 시네마틱 비주얼 디렉션.';
 const negative=val('negative').trim()||'해부학 오류, 손가락 또는 팔다리 추가, 오브젝트 복제, 의도치 않은 카메라 변경, 포즈 재해석, 불일치한 조명, 잘못된 레퍼런스 혼합 금지.';
 const analysis=imageAnalysis?analysisText():'머신 이미지 분석 없음. 수동으로 지정한 레퍼런스 역할과 우선순위를 따릅니다.';
 const scene=brief||'업로드된 레퍼런스 분석 내용을 주요 장면 설명으로 사용합니다.';
 const labels={'Reference':'레퍼런스','Reference Lock':'레퍼런스 고정','Reference Priority':'레퍼런스 우선순위','Image Analysis':'이미지 분석','Scene':'장면','Subject':'피사체','Subject / Scene':'피사체 / 장면','Composition':'구도','Character Action':'캐릭터 동작','Action':'동작','Camera':'카메라','Lighting':'라이팅','Environment Motion':'환경 모션','Motion':'모션','Effects':'이펙트','Environment':'환경','Materials / Style':'재질 / 스타일','Edit / Preservation Rules':'편집 / 유지 규칙','Constraints':'제약사항','Negative Constraints':'금지사항'};
 const map={'Reference':refs,'Reference Lock':refs,'Reference Priority':refs,'Image Analysis':analysis,'Scene':scene,'Subject':scene,'Subject / Scene':scene,'Composition':scene,'Character Action':scene,'Action':scene,'Camera':camera,'Lighting':lighting,'Environment Motion':motion,'Motion':motion,'Effects':motion,'Environment':style,'Materials / Style':style,'Edit / Preservation Rules':`레퍼런스 정체성, 구조, 포즈, 레이아웃, 카메라를 지정된 우선순위에 따라 유지합니다. 포즈 유지 강도: ${val('pose')}%.`,'Constraints':negative,'Negative Constraints':negative};
 return `모델: ${model}\n모드: ${mode==='IMAGE'?'이미지':'비디오'}\n\n`+structures[model].map(sec=>line(labels[sec]||sec,map[sec])).join('\n');
}
function generatePrompt(){
 promptVariants={};
 promptVariantsKo={};
 formats[mode].forEach(model=>{
   promptVariants[model]=buildPromptFor(model);
   promptVariantsKo[model]=buildPromptForKorean(model);
 });
 outputLanguage='EN';
 const selected=currentModel();
 activeFormat=formats[mode].includes(selected)?selected:formats[mode][0];
 showFormat(activeFormat);
 inspect();
}
function inspect(){let risk=12,issues=[];if(mode==='VIDEO'&&val('move')==='Static'&&/dolly|push|pull|orbit|pan|tilt/i.test(val('brief'))){risk+=55;issues.push('Core request contains camera movement while Camera is set to Static.')}if(+val('pose')>90&&mode==='VIDEO'&&+val('charMotion')>85){risk+=20;issues.push('Very high pose lock and character motion may conflict.')}if(+val('bloom')>75){risk+=10;issues.push('Bloom is very strong and may reduce detail readability.')}if(uploadedImages.length&&!imageAnalysis){risk+=15;issues.push('Reference images are uploaded but not analyzed yet.')}el('sRef').textContent=Math.round((+val('r1')+ +val('r2')+ +val('r3')+ +val('r4'))/4)+'/100';el('sPose').textContent=val('pose')+'/100';el('sCam').textContent=(mode==='VIDEO'&&val('move')!=='Static'?88:95)+'/100';el('sMotion').textContent=mode==='VIDEO'?Math.round((+val('charMotion')+ +val('envMotion'))/2)+'/100':'N/A';el('sRisk').textContent=Math.min(risk,100)+'/100';el('issues').innerHTML=issues.length?issues.map(x=>'• '+x).join('<br>'):'No major contradictions detected.'}
function showTab(name,btn){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');['prompt','inspect','analysis'].forEach(n=>el(n+'Pane').style.display=n===name?'block':'none')}
function copyPrompt(){navigator.clipboard.writeText(currentPrompt)}
function downloadPrompt(){if(!currentPrompt)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([currentPrompt],{type:'text/plain'}));a.download='prompt-director.txt';a.click();URL.revokeObjectURL(a.href)}
async function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
el('imageFiles').addEventListener('change',async e=>{const files=[...e.target.files].slice(0,4);uploadedImages=[];imageAnalysis=null;el('thumbs').innerHTML='';for(let i=0;i<files.length;i++){const dataUrl=await fileToDataUrl(files[i]);uploadedImages.push({name:files[i].name,dataUrl});const d=document.createElement('div');d.className='thumb';d.innerHTML=`<img src="${dataUrl}"><span>Ref ${String(i+1).padStart(2,'0')}</span>`;el('thumbs').appendChild(d)}el('analysisStatus').textContent=files.length?`${files.length} image(s) ready for analysis.`:'최대 4장의 이미지를 업로드할 수 있습니다.';inspect()});
async function analyzeImages(){if(!uploadedImages.length){el('analysisStatus').textContent='먼저 이미지를 업로드하세요.';return}el('analyzeBtn').disabled=true;el('analysisStatus').textContent='Analyzing…';try{const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:uploadedImages.map(x=>x.dataUrl)})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Analysis failed');imageAnalysis=data.analysis;const pretty=typeof imageAnalysis==='string'?imageAnalysis:JSON.stringify(imageAnalysis,null,2);el('analysisOutput').textContent=pretty;el('analysisMirror').textContent=pretty;if(imageAnalysis.suggested_reference_roles&&!val('refRoles').trim())el('refRoles').value=imageAnalysis.suggested_reference_roles;el('analysisStatus').textContent='Analysis complete. 결과가 프롬프트에 자동 반영됩니다.';inspect()}catch(err){el('analysisStatus').textContent='Analysis failed: '+err.message}finally{el('analyzeBtn').disabled=false}}
el('imageModeBtn').addEventListener('touchend',function(e){e.preventDefault();setMode('IMAGE')},{passive:false});
el('videoModeBtn').addEventListener('touchend',function(e){e.preventDefault();setMode('VIDEO')},{passive:false});
setMode('VIDEO');
