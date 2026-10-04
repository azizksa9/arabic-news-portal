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
  const summary=await fetchSummary(x);
  if(token!==heroSummaryToken||!summary)return;
  heroDesc.textContent=summary;heroDesc.style.display='block';heroDesc.classList.add('show');
}
const summaryCache=new Map(),summaryPending=new Map(),diacriticsCache=new Map(),diacriticsPending=new Map();
async function vocalizeTitle(title=''){
  title=String(title||'').trim();if(!title)return'';
  if(diacriticsCache.has(title))return diacriticsCache.get(title);
  if(diacriticsPending.has(title))return diacriticsPending.get(title);
  const job=(async()=>{try{
    const r=await fetch('/api/diacritize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:title}),cache:'no-store'});
    if(!r.ok)return title;
    const data=await r.json(),v=String(data.text||'').trim()||title;
    diacriticsCache.set(title,v);return v;
  }catch{return title}finally{diacriticsPending.delete(title)}})();
  diacriticsPending.set(title,job);return job;
}
function storyKey(x){return String(x?.articleUrl||x?.url||x?.title||'')}
async function fetchSummary(x){
  const key=storyKey(x);if(!key)return'';
  if(summaryCache.has(key))return summaryCache.get(key);
  if(summaryPending.has(key))return summaryPending.get(key);
  const job=(async()=>{try{
    const r=await fetch('/api/summary?url='+encodeURIComponent(x.articleUrl||x.url||'')+'&title='+encodeURIComponent(x.title||'')+'&desc='+encodeURIComponent(x.description||'')+'&v=10',{cache:'no-store'});
    if(!r.ok)return'';
    const data=await r.json(),summary=String(data.summary||'').trim();
    if(summary)summaryCache.set(key,summary);
    return summary;
  }catch{return''}finally{summaryPending.delete(key)}})();
  summaryPending.set(key,job);return job;
}
function prefetchUpcoming(from,count=6){
  if(!headlines.length)return;
  for(let n=0;n<count;n++){const x=headlines[(from+n)%headlines.length];if(x)fetchSummary(x)}
}
async function warmFirstStories(count=6){
  const first=headlines.slice(0,Math.min(count,headlines.length));
  if(!first.length)return;
  const work=Promise.allSettled(first.map(fetchSummary));
  const timeout=new Promise(resolve=>setTimeout(resolve,12000));
  await Promise.race([work,timeout]);
}
let heroSummaryToken=0;
function showHero(){if(!headlines.length)return;const current=heroIndex%headlines.length,x=headlines[current],next=headlines[(current+1)%headlines.length];const cleanDesc=(x.description||'').replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/\s+/g,' ').trim();heroSeconds=readingSeconds(x.title,cleanDesc);countdown=heroSeconds;paintCountdown();heroTitle.classList.remove('show');heroDesc.classList.remove('show');setTimeout(()=>{heroSource.textContent=x.source;if(heroImage){heroImage.classList.remove('show');if(x.image){heroImage.onload=()=>{heroImage.style.display='block';setTimeout(()=>heroImage.classList.add('show'),40)};heroImage.onerror=()=>{heroImage.removeAttribute('src');heroImage.style.display='none'};heroImage.src='/api/image?url='+encodeURIComponent(x.image)}else{heroImage.removeAttribute('src');heroImage.style.display='none'}}heroTitle.textContent=x.title;vocalizeTitle(x.title).then(v=>{if(heroTitle.textContent===x.title){heroTitle.textContent=v;if(currentStory&&currentStory.rawTitle===x.title){currentStory.title=v}}});const titleNorm=String(x.title||'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();const descNorm=cleanDesc.replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();const validDesc=cleanDesc&&cleanDesc.split(/\s+/).length>=12&&descNorm!==titleNorm&&!descNorm.startsWith(titleNorm)&&!titleNorm.startsWith(descNorm);const d=validDesc?cleanDesc:'';heroDesc.textContent=d;heroDesc.style.display=d?'block':'none';heroMeta.textContent=dateText(x.date);const pos=document.querySelector('#heroPosition'),nxt=document.querySelector('#nextStory');if(pos)pos.textContent=(current+1)+' / '+headlines.length;if(nxt)nxt.textContent='التالي: '+(next?.title||'خبر جديد');heroTitle.classList.add('show');if(d)heroDesc.classList.add('show');const summaryToken=++heroSummaryToken;const cached=summaryCache.get(storyKey(x));if(cached){heroDesc.textContent=cached;heroDesc.style.display='block';heroDesc.classList.add('show')}else updateStorySummary(x,summaryToken);prefetchUpcoming(current+1,6);heroIndex++;currentStory={title:x.title,rawTitle:x.title,desc:''};vocalizeTitle(x.title).then(v=>{if(currentStory&&currentStory.rawTitle===x.title)currentStory.title=v;speakStory(v,'')});scheduleHero()},300)}
function tick(){clock.textContent=new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});if(headlines.length){countdown--;if(countdown<0)countdown=0;paintCountdown()}}
async function load(){try{const r=await fetch('/api/news?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const data=await r.json();const a=Array.isArray(data)?data:(data.items||[]);if(!Array.isArray(data)&&data.hero&&data.hero.length)headlines=data.hero;const arabia=a.filter(x=>x.source==='العربية'&&x.description&&x.description.trim().split(/\s+/).length>=30).slice(0,8);const others=names.slice(1).map(name=>a.filter(x=>x.source===name&&x.description&&x.description.trim().split(/\s+/).length>=30).slice(0,2));if(!headlines.length)headlines=[];for(let i=0;i<8&&!(data.hero&&data.hero.length);i++){if(arabia[i])headlines.push(arabia[i]);const pool=others[i%others.length];if(pool&&pool[Math.floor(i/others.length)])headlines.push(pool[Math.floor(i/others.length)])}if(!headlines.length)headlines=a.filter(x=>x.source==='العربية').slice(0,3);box.innerHTML=names.map(name=>{const items=a.filter(x=>x.source===name).sort((x,y)=>(Date.parse(y.date||0)||0)-(Date.parse(x.date||0)||0)).slice(0,8);const text=items.length?items.map(x=>{const d=x.date?new Date(x.date):null;const tm=d&&!isNaN(d)?d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'';return esc((tm?tm+' — ':'')+x.title)}).join('　 ◆　 '):'جارٍ تحديث الأخبار…';return '<div class="strip ticker"><b>'+name+'</b><div class="ticker-window"><span>'+text+'</span></div></div>'}).join('');document.querySelector('#updated').textContent='آخر تحديث: '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});if(!heroTimer){heroIndex=0;prefetchUpcoming(0,6);await warmFirstStories(6);showHero()}else if(headlines.length){heroIndex=heroIndex%headlines.length;prefetchUpcoming(heroIndex,6)}}catch(e){box.innerHTML=names.map(n=>'<div class="strip ticker"><b>'+n+'</b><div class="ticker-window"><span>جارٍ تحديث الأخبار…</span></div></div>').join('')}}
const prompts=['تابع الحساب لمتابعة آخر الأخبار','ما الخبر الذي تريد معرفة تفاصيله؟ اكتب في التعليقات','شارك البث مع من يهتم بمتابعة الأخبار'];let promptIndex=0;function rotatePrompt(){const e=document.querySelector('#engage');if(!e)return;e.classList.remove('visible');setTimeout(()=>{e.textContent=prompts[promptIndex++%prompts.length];e.classList.add('visible');setTimeout(()=>e.classList.remove('visible'),7000)},300)}
tick();setInterval(tick,1000);load();setTimeout(rotatePrompt,8000);setInterval(rotatePrompt,60000);setInterval(load,60000);
const soundBtn=document.querySelector('#soundBtn');if(soundBtn)soundBtn.addEventListener('click',async()=>{soundEnabled=true;lastSpokenKey='';const audio=ensureAudio();try{audio.muted=false;audio.volume=1;if(currentStory)await speakStory(currentStory.title,'');else soundBtn.textContent='🔊 الصوت يعمل'}catch(e){const reason=(e&&e.message?e.message:'خطأ غير معروف').replace(/\s+/g,' ').slice(0,70);soundBtn.textContent='⚠️ '+reason}});

const PROMO_LINKS=['https://vt.tiktok.com/ZSbSSJcT6/','https://vt.tiktok.com/ZSbSS5oYL/','https://vt.tiktok.com/ZSbSSVFxq/'];let promoActive=false,lastPromo=-1,promoFallback=null;
function pickPromo(){let i=Math.floor(Math.random()*PROMO_LINKS.length);if(i===lastPromo)i=(i+1)%PROMO_LINKS.length;lastPromo=i;return i}
function endPromo(){promoActive=false;if(promoFallback){clearTimeout(promoFallback);promoFallback=null}const o=document.querySelector('#promoOverlay'),f=document.querySelector('#promoFrame');if(f)f.innerHTML='';if(o){o.classList.remove('show');o.setAttribute('aria-hidden','true')}}
async function startPromo(){if(promoActive)return;promoActive=true;if(currentAudio){try{currentAudio.pause()}catch{}}const o=document.querySelector('#promoOverlay'),f=document.querySelector('#promoFrame');if(!o||!f){promoActive=false;return}o.classList.add('show');o.setAttribute('aria-hidden','false');f.innerHTML='<div style="color:white;text-align:center;padding-top:35vh">جارٍ تجهيز الفيديو…</div>';try{const link=PROMO_LINKS[pickPromo()],r=await fetch('/api/tiktok?url='+encodeURIComponent(link),{cache:'no-store'}),j=await r.json();if(!r.ok||!j.embed)throw new Error(j.error||'embed');f.innerHTML='<iframe id="promoPlayer" src="'+j.embed+'" allow="autoplay; encrypted-media; fullscreen" allowfullscreen playsinline></iframe>';promoFallback=setTimeout(endPromo,120000)}catch(e){f.innerHTML='<div style="color:white;text-align:center;padding:30vh 20px">تعذر تشغيل الفيديو. ستعود الأخبار الآن.</div>';setTimeout(endPromo,2500)}}
window.addEventListener('message',e=>{if(!promoActive)return;const d=e.data||{};if(d.type==='onStateChange'&&(d.value===0||d.value==='ended'))endPromo();if(d.event==='ended'||d.type==='ended')endPromo()});
document.querySelector('#promoClose')?.addEventListener('click',endPromo);setTimeout(startPromo,60*1000);setInterval(startPromo,60*1000);
