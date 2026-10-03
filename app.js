const box=document.querySelector('#strips'),heroTitle=document.querySelector('#heroTitle'),heroSource=document.querySelector('#heroSource'),heroDesc=document.querySelector('#heroDesc'),heroMeta=document.querySelector('#heroMeta'),heroImage=document.querySelector('#heroImage'),clock=document.querySelector('#clock');
const names=['العربية','الشرق للأخبار','سكاي نيوز عربية','CNN بالعربية','الجزيرة'];const MIN_HERO_SECONDS=20,MAX_HERO_SECONDS=20;let headlines=[],heroIndex=0,countdown=MIN_HERO_SECONDS,heroSeconds=MIN_HERO_SECONDS,heroTimer=null,soundEnabled=false,currentStory=null,lastSpokenKey='';
function esc(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateText(d){if(!d)return'';const x=new Date(d);return isNaN(x)?'':x.toLocaleString('ar-SA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function ensureCountdown(){let el=document.querySelector('#heroCountdown');if(el)return el;el=document.createElement('div');el.id='heroCountdown';el.setAttribute('aria-label','الوقت المتبقي للخبر التالي');el.style.cssText='position:absolute;left:24px;bottom:22px;z-index:9;display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(5,16,30,.82);border:3px solid #ff334d;color:#fff;font-weight:800;font-size:24px;box-shadow:0 0 0 5px rgba(255,51,77,.12);font-variant-numeric:tabular-nums';const hero=heroTitle.closest('.hero')||heroTitle.parentElement;hero.style.position='relative';hero.appendChild(el);return el}
function paintCountdown(){const el=ensureCountdown();el.textContent=countdown+' ث';el.style.background='conic-gradient(#ff334d '+((heroSeconds-countdown)/heroSeconds*360)+'deg,rgba(5,16,30,.88) 0)';}
function readingSeconds(){return 20}
function scheduleHero(){clearTimeout(heroTimer);heroTimer=setTimeout(showHero,heroSeconds*1000)}
let currentAudio=null;
function ensureAudio(){
  let a=document.querySelector('#newsAudio');
  if(a)return a;
  a=document.createElement('audio');a.id='newsAudio';a.preload='auto';a.setAttribute('playsinline','');a.style.display='none';document.body.appendChild(a);return a;
}
async function fetchSpeechUrl(text){
  const r=await fetch('/api/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
  if(!r.ok){let msg='';try{msg=(await r.json()).error||''}catch{}throw new Error(msg||('HTTP '+r.status))}
  return URL.createObjectURL(await r.blob());
}
async function playSpeech(text){
  const audio=ensureAudio();currentAudio=audio;
  if(soundBtn)soundBtn.textContent='🔊 الصوت يعمل';
  const url=await fetchSpeechUrl(text);
  if(audio.dataset.url)URL.revokeObjectURL(audio.dataset.url);
  audio.dataset.url=url;audio.src=url;audio.load();
  if(soundBtn)soundBtn.textContent='🔊 الصوت يعمل';
  audio.onplaying=()=>{if(soundBtn)soundBtn.textContent='🔊 الصوت يعمل'};
  audio.onended=()=>{if(soundBtn)soundBtn.textContent='🔊 الصوت يعمل'};
  audio.onerror=()=>{lastSpokenKey='';if(soundBtn)soundBtn.textContent='⚠️ تعذر تشغيل ملف الصوت'};
  await audio.play();
}
async function speakStory(title='',desc=''){
  if(!soundEnabled)return;
  const text=String(title||'').replace(/\s*[#＃]\s*(العربية|Al Arabiya)\s*$/i,'').replace(/\s*[-–—|]\s*(العربية|Al Arabiya)\s*$/i,'').replace(/\s+(العربية)\s*$/,'').replace(/\s+/g,' ').trim();
  if(!text||text===lastSpokenKey)return;
  lastSpokenKey=text;
  try{await playSpeech(text)}
  catch(e){lastSpokenKey='';const reason=(e&&e.message?e.message:'خطأ غير معروف').replace(/\s+/g,' ').slice(0,70);if(soundBtn)soundBtn.textContent='⚠️ '+reason}
}
async function updateStorySummary(x,token){
  if(!x?.url)return;
  try{
    const r=await fetch('/api/summary?url='+encodeURIComponent(x.url)+'&title='+encodeURIComponent(x.title),{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json(),summary=String(data.summary||'').trim();
    if(token!==heroSummaryToken||!summary||summary.split(/\s+/).length<20)return;
    heroDesc.textContent=summary;heroDesc.style.display='block';heroDesc.classList.add('show');
  }catch{}
}
let heroSummaryToken=0;
function showHero(){if(!headlines.length)return;const current=heroIndex%headlines.length,x=headlines[current],next=headlines[(current+1)%headlines.length];const cleanDesc=(x.description||'').replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/\s+/g,' ').trim();heroSeconds=readingSeconds(x.title,cleanDesc);countdown=heroSeconds;paintCountdown();heroTitle.classList.remove('show');heroDesc.classList.remove('show');setTimeout(()=>{heroSource.textContent=x.source;if(heroImage){heroImage.classList.remove('show');if(x.image){heroImage.onload=()=>{heroImage.style.display='block';setTimeout(()=>heroImage.classList.add('show'),40)};heroImage.onerror=()=>{heroImage.removeAttribute('src');heroImage.style.display='none'};heroImage.src='/api/image?url='+encodeURIComponent(x.image)}else{heroImage.removeAttribute('src');heroImage.style.display='none'}}heroTitle.textContent=x.title;const d=cleanDesc;heroDesc.textContent=d;heroDesc.style.display=d?'block':'none';heroMeta.textContent=dateText(x.date);const pos=document.querySelector('#heroPosition'),nxt=document.querySelector('#nextStory');if(pos)pos.textContent=(current+1)+' / '+headlines.length;if(nxt)nxt.textContent='التالي: '+(next?.title||'خبر جديد');heroTitle.classList.add('show');if(d)heroDesc.classList.add('show');const summaryToken=++heroSummaryToken;updateStorySummary(x,summaryToken);heroIndex++;currentStory={title:x.title,desc:''};speakStory(x.title,'');scheduleHero()},300)}
function tick(){clock.textContent=new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});if(headlines.length){countdown--;if(countdown<0)countdown=0;paintCountdown()}}
async function load(){try{const r=await fetch('/api/news?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const data=await r.json();const a=Array.isArray(data)?data:(data.items||[]);if(!Array.isArray(data)&&data.hero&&data.hero.length)headlines=data.hero;const arabia=a.filter(x=>x.source==='العربية'&&x.description&&x.description.trim().split(/\s+/).length>=30).slice(0,8);const others=names.slice(1).map(name=>a.filter(x=>x.source===name&&x.description&&x.description.trim().split(/\s+/).length>=30).slice(0,2));if(!headlines.length)headlines=[];for(let i=0;i<8&&!(data.hero&&data.hero.length);i++){if(arabia[i])headlines.push(arabia[i]);const pool=others[i%others.length];if(pool&&pool[Math.floor(i/others.length)])headlines.push(pool[Math.floor(i/others.length)])}if(!headlines.length)headlines=a.filter(x=>x.source==='العربية').slice(0,3);box.innerHTML=names.map(name=>{const items=a.filter(x=>x.source===name).slice(0,8);const text=items.length?items.map(x=>esc(x.title)).join('　 ◆　 '):'جارٍ تحديث الأخبار…';return '<div class="strip ticker"><b>'+name+'</b><div class="ticker-window"><span>'+text+'</span></div></div>'}).join('');document.querySelector('#updated').textContent='آخر تحديث: '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});heroIndex=0;showHero()}catch(e){box.innerHTML=names.map(n=>'<div class="strip ticker"><b>'+n+'</b><div class="ticker-window"><span>جارٍ تحديث الأخبار…</span></div></div>').join('')}}
const prompts=['تابع الحساب لمتابعة آخر الأخبار','ما الخبر الذي تريد معرفة تفاصيله؟ اكتب في التعليقات','شارك البث مع من يهتم بمتابعة الأخبار'];let promptIndex=0;function rotatePrompt(){const e=document.querySelector('#engage');if(!e)return;e.classList.remove('visible');setTimeout(()=>{e.textContent=prompts[promptIndex++%prompts.length];e.classList.add('visible');setTimeout(()=>e.classList.remove('visible'),7000)},300)}
tick();setInterval(tick,1000);load();setTimeout(rotatePrompt,8000);setInterval(rotatePrompt,60000);setInterval(load,120000);
const soundBtn=document.querySelector('#soundBtn');if(soundBtn)soundBtn.addEventListener('click',async()=>{soundEnabled=true;lastSpokenKey='';const audio=ensureAudio();try{audio.muted=false;audio.volume=1;if(currentStory)await speakStory(currentStory.title,'');else soundBtn.textContent='🔊 الصوت يعمل'}catch(e){const reason=(e&&e.message?e.message:'خطأ غير معروف').replace(/\s+/g,' ').slice(0,70);soundBtn.textContent='⚠️ '+reason}});
