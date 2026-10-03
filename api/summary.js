export const config={runtime:'edge'};
function dec(s=''){let x=s.replace(/<!\[CDATA\[|\]\]>/g,'');for(let i=0;i<3;i++)x=x.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;|&#160;|&#xA0;/gi,' ');return x}
function txt(s=''){return dec(s).replace(/<[^>]+>/g,' ').replace(/&[a-zA-Z0-9#]+;/g,' ').replace(/\s+/g,' ').trim()}
function meta(h,key){const tags=h.match(/<meta\b[^>]*>/gi)||[];for(const t of tags){const k=(t.match(/(?:property|name)=["']([^"']+)["']/i)||[])[1];if(k!==key)continue;const v=(t.match(/content=["']([^"']*)["']/i)||[])[1];if(v)return txt(v)}return''}
function objects(v,out=[]){if(!v||typeof v!=='object')return out;if(Array.isArray(v)){v.forEach(x=>objects(x,out));return out}out.push(v);Object.values(v).forEach(x=>objects(x,out));return out}
function articleData(h){
  let best='';
  for(const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      for(const o of objects(JSON.parse(m[1]))){
        if(!o)continue;
        const type=String(o['@type']||'');
        const raw=o.articleBody||((/NewsArticle|Article|ReportageNewsArticle/i.test(type))?o.description:'')||'';
        const body=txt(raw);
        if(body.split(/\s+/).length>best.split(/\s+/).length)best=body;
      }
    }catch{}
  }
  return best.split(/\s+/).length>=25?best:''
}
function nextDataBody(h,title=''){
  const m=h.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!m)return'';
  try{
    const root=JSON.parse(m[1]), candidates=[];
    for(const o of objects(root)){
      for(const k of ['articleBody','body','content','description','text']){
        if(typeof o?.[k]==='string'){
          const v=txt(o[k]),wc=v.split(/\s+/).length;
          if(wc>=35&&wc<=4000)candidates.push(v);
        }
      }
    }
    const tw=norm(title).split(/\s+/).filter(w=>w.length>=4).slice(0,10);
    candidates.sort((a,b)=>{
      const score=x=>tw.filter(w=>norm(x).includes(w)).length*100+Math.min(x.split(/\s+/).length,500);
      return score(b)-score(a)
    });
    const best=candidates[0]||'';
    if(!best)return'';
    const hits=tw.filter(w=>norm(best).includes(w)).length;
    return !tw.length||hits>=Math.min(2,tw.length)?best:''
  }catch{return''}
}
function paragraphBody(h,title=''){
  const zones=[];
  for(const re of [/<article\b[^>]*>([\s\S]*?)<\/article>/gi,/<main\b[^>]*>([\s\S]*?)<\/main>/gi]){
    for(const m of h.matchAll(re))zones.push(m[1]);
    if(zones.length)break;
  }
  if(!zones.length)return'';
  const bad=/(ملفات تعريف الارتباط|ملفات الارتباط|الكوكيز|الخصوصية|تخصيص|اهتماماتك|تصفح|اشترك|اشتراك|سجّل|تسجيل الدخول|تابعنا|اقرأ أيضا|اقرأ أيضًا|ذات صلة|المزيد من|حقوق النشر|إعلان|الإعلانات|شروط الاستخدام|سياسة الاستخدام)/i;
  const titleWords=norm(title).split(/\s+/).filter(w=>w.length>=4).slice(0,10);
  const ps=[];
  for(const zone of zones){
    const cleaned=zone.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<nav[\s\S]*?<\/nav>/gi,' ').replace(/<footer[\s\S]*?<\/footer>/gi,' ').replace(/<aside[\s\S]*?<\/aside>/gi,' ');
    for(const m of cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)){
      const p=txt(m[1]),wc=p.split(/\s+/).length;
      if(wc>=8&&!bad.test(p))ps.push(p);
    }
  }
  if(!ps.length)return'';
  const joined=ps.slice(0,24).join(' ');
  if(titleWords.length){
    const n=norm(joined),hits=titleWords.filter(w=>n.includes(w)).length;
    if(hits<Math.min(2,titleWords.length))return'';
  }
  return joined;
}
function norm(s=''){return txt(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function summarize(title,body){body=txt(body);if(!body)return'';const t=norm(title),parts=body.match(/[^.!؟\n]+[.!؟]?/g)||[body],out=[];let words=0;for(let p of parts){p=p.trim();if(!p)continue;const n=norm(p);if(!out.length&&t&&(n.includes(t)||t.includes(n)))continue;const wc=p.split(/\s+/).length;if(wc<4)continue;out.push(p);words+=wc;if(out.length>=8||words>=125)break}return out.join(' ').split(/\s+/).slice(0,125).join(' ')}
async function relatedContext(title){
  try{
    const q=encodeURIComponent(title.replace(/[#＃]\s*العربية/gi,'').slice(0,160));
    const r=await fetch('https://news.google.com/rss/search?q='+q+'&hl=ar&gl=SA&ceid=SA:ar',{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
    if(!r.ok)return'';
    const xml=await r.text(),chunks=[];
    for(const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
      const b=m[1],d=(b.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)||[])[1]||'';
      const x=txt(d);if(x&&x.split(/\s+/).length>=12)chunks.push(x);
      if(chunks.length>=6)break;
    }
    return chunks.join(' ');
  }catch{return''}
}
async function findOriginalArticle(title){
  try{
    const q=encodeURIComponent('site:alarabiya.net '+title.replace(/[#＃]\s*العربية/gi,'').slice(0,180));
    const r=await fetch('https://www.google.com/search?q='+q,{headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'ar,en;q=0.8'},redirect:'follow',cache:'no-store'});
    if(!r.ok)return'';
    const h=await r.text(), links=[];
    for(const m of h.matchAll(/https?:\/\/(?:www\.)?alarabiya\.net\/[^"&<>\s]+/gi)){
      let u=m[0].replace(/&amp;.*/,'');
      try{u=decodeURIComponent(u)}catch{}
      if(!links.includes(u))links.push(u);
    }
    return links.find(u=>/alarabiya\.net\/(arab-and-world|aswaq|saudi-today|last-page|sport|medicine-and-health|technology|variety|politics|international)/i.test(u))||links[0]||'';
  }catch{return''}
}
async function fetchArticleBody(raw,title){
  try{
    const target=new URL(raw);if(!/^https?:$/.test(target.protocol))return'';
    const r=await fetch(target.toString(),{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml','Accept-Language':'ar,en;q=0.8'},redirect:'follow',cache:'no-store'});
    if(!r.ok)return'';
    const h=await r.text();
    return articleData(h)||nextDataBody(h,title)||paragraphBody(h,title)||'';
  }catch{return''}
}
function titleTerms(title=''){return norm(title).split(/\s+/).filter(w=>w.length>=4&&!['العربية','عاجل','الخبر','اليوم','الآن','قال','أكد'].includes(w)).slice(0,12)}
function matchScore(title,text=''){
  const terms=titleTerms(title),n=norm(text);if(!terms.length)return 0;
  return terms.filter(w=>n.includes(w)).length/terms.length
}
async function verifiedNewsContext(title){
  try{
    const clean=title.replace(/[#＃]\s*العربية/gi,'').replace(/["“”]/g,'').trim();
    const q=encodeURIComponent('"'+clean.slice(0,170)+'"');
    const r=await fetch('https://news.google.com/rss/search?q='+q+'&hl=ar&gl=SA&ceid=SA:ar',{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
    if(!r.ok)return'';
    const xml=await r.text(),good=[];
    for(const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
      const b=m[1],rt=txt((b.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)||[])[1]||''),rd=txt((b.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)||[])[1]||'');
      const score=matchScore(title,rt);
      if(score>=0.72&&rd.split(/\s+/).length>=10)good.push({score,text:rd,title:rt});
    }
    good.sort((a,b)=>b.score-a.score);
    if(!good.length)return'';
    return good.slice(0,3).map(x=>x.title+' — '+x.text).join('\n');
  }catch{return''}
}
async function aiSummary(title,context){
  const key=process.env.OPENAI_API_KEY;if(!key||!context)return'';
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-mini',input:'لخّص الخبر التالي بالعربية في 5 إلى 10 أسطر قصيرة مناسبة لشاشة هاتف. لا تكرر العنوان في البداية. استخدم فقط الوقائع المشتركة أو الواضحة في المادة المتاحة، ولا تضف أي معلومة غير موجودة فيها. إذا وجدت تفاصيل متعارضة فتجاهلها. ركّز على أهم الوقائع والتفاصيل.\n\nالعنوان: '+title+'\n\nالمادة المتاحة: '+context.slice(0,9000),max_output_tokens:450})});
    if(!r.ok)return'__AI_ERROR_'+r.status+'__';const j=await r.json();const direct=String(j.output_text||'').trim();if(direct)return direct;const parts=[];for(const item of (j.output||[])){for(const c of (item.content||[])){if(typeof c.text==='string')parts.push(c.text)}}return parts.join('\n').trim();
  }catch{return''}
}
export default async function handler(req){try{
  const u=new URL(req.url),raw=u.searchParams.get('url')||'',title=u.searchParams.get('title')||'';
  if(!title)return Response.json({summary:''});
  let body='',articleUrl='',source='';
  if(raw){body=await fetchArticleBody(raw,title);if(body)source='provided-article'}
  if(!body||body.split(/\s+/).length<35){
    articleUrl=await findOriginalArticle(title);
    if(articleUrl){body=await fetchArticleBody(articleUrl,title);if(body)source='alarabiya-search'}
  }
  if(!body||body.split(/\s+/).length<35){const verified=await verifiedNewsContext(title);if(verified){body=verified;source='verified-news'}}if(!body||body.split(/\s+/).length<35)return Response.json({summary:'',articleUrl,source:'none',ai:false,aiStatus:'not-used',bodyWords:body?body.split(/\\s+/).length:0,summaryScore:0,reason:'no-matching-article-content'});
  const aiRaw=await aiSummary(title,body);const aiError=String(aiRaw||'').match(/^__AI_ERROR_(\\d+)__$/);const ai=aiError?'':aiRaw;let summary=ai||summarize(title,body);const score=summary?matchScore(title,summary):0;if(summary&&score<0.38)summary='';
  return new Response(JSON.stringify({summary,articleUrl,source,ai:!!ai,aiStatus:aiError?Number(aiError[1]):(ai?'ok':'not-used'),bodyWords:body.split(/\\s+/).length,summaryScore:score}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'}})
}catch{return Response.json({summary:''})}}