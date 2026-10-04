const box=document.querySelector('#strips'),heroTitle=document.querySelector('#heroTitle'),heroSource=document.querySelector('#heroSource'),heroDesc=document.querySelector('#heroDesc'),heroMeta=document.querySelector('#heroMeta'),heroImage=document.querySelector('#heroImage'),clock=document.querySelector('#clock');
const names=['العربية','الشرق للأخبار','سكاي نيوز عربية','CNN بالعربية','الجزيرة'];const MIN_HERO_SECONDS=20,MAX_HERO_SECONDS=20;let headlines=[],heroIndex=0,countdown=MIN_HERO_SECONDS,heroSeconds=MIN_HERO_SECONDS,heroTimer=null,soundEnabled=false,currentStory=null,lastSpokenKey='';
function esc(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateText(d){if(!d)return'';const x=new Date(d);return isNaN(x)?'':x.toLocaleString('ar-SA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function ensureCountdown(){let el=document.querySelector('#heroCountdown');if(el)return el;el=document.createElement('div');el.id='heroCountdown';el.setAttribute('aria-label','الوقت المتبقي للخبر التالي');el.style.cssText='position:absolute;left:24px;bottom:22px;z-index:9;display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(5,16,30,.82);border:3px solid #ff334d;color:#fff;font-weight:800;font-size:24px;box-shadow:0 0 0 5px rgba(255,51,77,.12);font-variant-numeric:tabular-nums';const hero=heroTitle.closest('.hero')||heroTitle.parentElement;hero.style.position='relative';hero.appendChild(el);return el}
function paintCountdown(){const el=ensureCountdown();el.textContent=countdown+' ث';el.style.background='conic-gradient(#ff334d '+((heroSeconds-countdown)/heroSeconds*360)+'deg,rgba(5,16,30,.88) 0)';}
function readingSeconds(){return 20}
function scheduleHero(){clearTimeout(heroTimer);heroTimer=setTimeout(showHero,heroSeconds*1000)}
let currentAudio=null;
const QURAN_RECITER='Alafasy_128kbps';
const QURAN_AYAH_COUNTS=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
let quranSurah=1,quranAyah=1;
function ensureAudio(){let a=document.querySelector('#newsAudio');if(a)return a;a=document.createElement('audio');a.id='newsAudio';a.preload='auto';a.setAttribute('playsinline','');a.style.display='none';document.body.appendChild(a);return a}
function pad3(n){return String(n).padStart(3,'0')}
function quranUrl(){return 'https://everyayah.com/data/'+QURAN_RECITER+'/'+pad3(quranSurah)+pad3(quranAyah)+'.mp3'}
function advanceAyah(){quranAyah++;if(quranAyah>QURAN_AYAH_COUNTS[quranSurah-1]){quranAyah=1;quranSurah++;if(quranSurah>114)quranSurah=1}}
async function playQuran(){if(!soundEnabled)return;const audio=ensureAudio();currentAudio=audio;audio.src=quranUrl();audio.load();audio.onended=()=>{advanceAyah();playQuran()};audio.onerror=()=>{advanceAyah();if(soundBtn)soundBtn.textContent='⚠️ تعذر تحميل التلاوة';setTimeout(()=>playQuran(),1500)};audio.onplaying=()=>{if(soundBtn)soundBtn.textContent='🔊 القرآن يعمل'};await audio.play()}
async function speakStory(){return}
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
const soundBtn=document.querySelector('#soundBtn');if(soundBtn)soundBtn.addEventListener('click',async()=>{const audio=ensureAudio();if(soundEnabled){soundEnabled=false;audio.pause();soundBtn.textContent='🔇 تشغيل القرآن';return}soundEnabled=true;try{audio.muted=false;audio.volume=1;soundBtn.textContent='⏳ جارٍ تشغيل القرآن';await playQuran()}catch(e){soundEnabled=false;soundBtn.textContent='⚠️ تعذر تشغيل القرآن'}});
