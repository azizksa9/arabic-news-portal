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
async function directArabia(){const feed='https://alikhbariya.net/feeds/sources/8f2e43a8-7327-4b8e-b95d-dea2a728ca4a.xml';try{const r=await fetch(feed,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/rss+xml,application/xml,text/xml'},redirect:'follow',cache:'no-store'});if(!r.ok)return{found:[],linkCount:0,feedStatus:r.status};const xml=await r.text();const found=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,50).map(x=>x[1]).map(b=>{const title=txt(tag(b,'title'));const raw=txt(tag(b,'content:encoded')||tag(b,'description')||tag(b,'summary'));const summary=usefulSummary(title,raw);return{title,description:summary,url:tag(b,'link'),image:imageFromItem(b),source:'العربية',date:tag(b,'pubDate')}}).filter(x=>x.title&&x.description.split(/\s+/).length>=12);const seen=new Set();const unique=found.filter(x=>{const k=x.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,50);return{found:unique,linkCount:unique.length,feedStatus:r.status}}catch{return{found:[],linkCount:0,feedStatus:0}}}
export default async function handler(){const [direct,settled]=await Promise.all([directArabia(),Promise.allSettled(sources.map(async s=>{const q=encodeURIComponent('site:'+s.domain),url='https://news.google.com/rss/search?q='+q+'&hl=ar&gl=SA&ceid=SA:ar';const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});if(!r.ok)throw 0;return parse(await r.text(),s.name)}))]);const hero=direct.found;const items=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);return new Response(JSON.stringify({hero,items,diagnostic:{directArabiaCount:hero.length,directArabiaOk:hero.length>0,directLinkCount:direct.linkCount,directFeedStatus:direct.feedStatus,generatedAt:new Date().toISOString()}}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, s-maxage=180'}})}