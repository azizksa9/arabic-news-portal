export const config={runtime:'edge'};
const sources=[{name:'العربية',domain:'alarabiya.net'},{name:'الشرق للأخبار',domain:'asharq.com'},{name:'سكاي نيوز عربية',domain:'skynewsarabia.com'},{name:'CNN بالعربية',domain:'arabic.cnn.com'},{name:'الجزيرة',domain:'aljazeera.net'}];
const A='https://www.alarabiya.net';
function dec(s=''){let x=s.replace(/<!\[CDATA\[|\]\]>/g,'');for(let i=0;i<3;i++)x=x.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;|&#160;|&#xA0;/gi,' ');return x}
function txt(s=''){return dec(s).replace(/<[^>]+>/g,' ').replace(/&[a-zA-Z0-9#]+;/g,' ').replace(/\s+/g,' ').trim()}
function tag(b,n){const m=b.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>','i'));return m?dec(m[1].trim()):''}
function parse(xml,source){return[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,15).map(x=>x[1]).map(b=>({title:txt(tag(b,'title')).replace(/\s+-\s+[^-]+$/,'').trim(),url:tag(b,'link'),source,date:tag(b,'pubDate')})).filter(x=>x.title)}
function imageFromItem(b){const m=b.match(/<media:content[^>]+url=["']([^"']+)["']/i)||b.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)||b.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i)||b.match(/<img[^>]+src=["']([^"']+)["']/i);return m?dec(m[1]):''}
function meta(h,key){const tags=h.match(/<meta\b[^>]*>/gi)||[];for(const t of tags){const k=(t.match(/(?:property|name)=["']([^"']+)["']/i)||[])[1];if(k!==key)continue;const v=(t.match(/content=["']([^"']*)["']/i)||[])[1];if(v)return txt(v)}return''}
function objects(v,out=[]){if(!v||typeof v!=='object')return out;if(Array.isArray(v)){v.forEach(x=>objects(x,out));return out}out.push(v);Object.values(v).forEach(x=>objects(x,out));return out}
function articleData(h){for(const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{for(const o of objects(JSON.parse(m[1]))){if(o&&(o.headline||o.name)&&(o.articleBody||o.description)){const title=txt(o.headline||o.name),body=txt(o.articleBody||o.description),url=typeof o.url==='string'?o.url:(o.mainEntityOfPage&&o.mainEntityOfPage['@id'])||'';if(title&&body.split(/\s+/).length>=30)return{title,body,url,date:o.datePublished||''}}}}catch{}}return null}
function normTitle(s=''){return txt(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function usefulSummary(title,raw){
  let body=txt(raw),t=normTitle(title);
  if(!body)return'';
  const sentences=body.match(/[^.!؟\n]+[.!؟]?/g)||[body];
  const kept=[];let words=0;
  for(let part of sentences){
    part=part.trim().replace(/^[-–—:؛،\s]+/,'');
    if(!part)continue;
    const n=normTitle(part);
    const overlap=t&&n&&(n.includes(t)||t.includes(n));
    if(overlap&&kept.length===0)continue;
    const wc=part.split(/\s+/).length;
    if(wc<4)continue;
    kept.push(part);words+=wc;
    if(kept.length>=7||words>=105)break;
  }
  let out=kept.join(' ').trim();
  if(!out){const tw=title.split(/\s+/);const bw=body.split(/\s+/);let cut=0;while(cut<Math.min(tw.length+8,bw.length)&&normTitle(bw.slice(0,cut+1).join(' ')).length<=t.length+25)cut++;out=bw.slice(cut,cut+95).join(' ')}
  return out.split(/\s+/).slice(0,110).join(' ').trim();
}
async function enrichStory(x){
  if(!x.url)return x;
  try{
    const r=await fetch(x.url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'},redirect:'follow',cache:'no-store'});
    if(!r.ok)return x;
    const h=await r.text(),a=articleData(h);
    let body=a?.body||meta(h,'og:description')||meta(h,'description')||'';
    const summary=usefulSummary(x.title,body);
    const img=meta(h,'og:image')||meta(h,'twitter:image')||x.image||'';
    return{...x,description:summary.split(/\s+/).length>=25?summary:x.description,image:img};
  }catch{return x}
}
async function enrichStories(list){
  const out=[];
  for(let i=0;i<list.length;i+=6){
    out.push(...await Promise.all(list.slice(i,i+6).map(enrichStory)));
  }
  return out;
}
async function directArabia(){
  const feed='https://alikhbariya.net/feeds/sources/8f2e43a8-7327-4b8e-b95d-dea2a728ca4a.xml';
  try{
    const r=await fetch(feed,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
    if(!r.ok)return{found:[],linkCount:0,feedStatus:r.status};
    const xml=await r.text(),found=[];
    for(const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
      const item=m[1],title=txt(tag(item,'title')).replace(/\s*[#＃]\s*العربية\s*$/,'').trim();
      const link=tag(item,'link'),guid=txt(tag(item,'guid'));
      const sourceTag=(item.match(/<source\b[^>]*url=["']([^"']+)["'][^>]*>/i)||[])[1]||'';
      const raw=tag(item,'description'),description=usefulSummary(title,raw)||txt(raw);
      const image=imageFromItem(item);
      const articleUrl=(/^https?:\/\//i.test(guid)?guid:(sourceTag&&sourceTag!==A?sourceTag:link));
      if(title)found.push({title,description,url:link||articleUrl,articleUrl,image,source:'العربية',date:tag(item,'pubDate')});
      if(found.length>=50)break;
    }
    const seen=new Set(),unique=found.filter(x=>{const k=normTitle(x.title);if(!k||seen.has(k))return false;seen.add(k);return true});
    return{found:unique,linkCount:unique.length,feedStatus:r.status};
  }catch{return{found:[],linkCount:0,feedStatus:0}}
}
export default async function handler(){const [direct,settled]=await Promise.all([directArabia(),Promise.allSettled(sources.map(async s=>{const q=encodeURIComponent('site:'+s.domain+' when:1d'),url='https://news.google.com/rss/search?q='+q+'&hl=ar&gl=SA&ceid=SA:ar&_='+Date.now();const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});if(!r.ok)throw 0;return parse(await r.text(),s.name)}))]);const enrichedDirect=await enrichStories(direct.found.slice(0,50));const complete=enrichedDirect.filter(x=>x.description&&x.description.trim().split(/\s+/).length>=12);const hero=complete.length>=10?complete:enrichedDirect.filter(x=>x.description&&x.description.trim().split(/\s+/).length>=8);let items=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
const directTicker=enrichedDirect.map(x=>({title:x.title,url:x.url,source:'العربية',date:x.date,description:x.description||'',image:x.image||''}));
items=items.filter(x=>x.source!=='العربية').concat(directTicker);
items.sort((a,b)=>{const ad=Date.parse(a.date||0)||0,bd=Date.parse(b.date||0)||0;return bd-ad});
return new Response(JSON.stringify({hero,items,diagnostic:{directArabiaCount:direct.found.length,completeHeroCount:hero.length,directArabiaOk:hero.length>0,directLinkCount:direct.linkCount,directFeedStatus:direct.feedStatus,generatedAt:new Date().toISOString()}}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'}})}