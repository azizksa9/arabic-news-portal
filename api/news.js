export const config={runtime:'edge'};
const sources=[
 {name:'العربية',domain:'alarabiya.net'},
 {name:'الإخبارية السعودية',direct:'https://alikhbariya.net/feeds/all.xml'},
 {name:'سكاي نيوز عربية',domain:'skynewsarabia.com'},
 {name:'CNN بالعربية',domain:'arabic.cnn.com'},
 {name:'الجزيرة',domain:'aljazeera.net'}
];
function dec(s=''){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(b,n){const m=b.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>','i'));return m?dec(m[1].trim()):''}
function parse(xml,source){return[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,15).map(x=>x[1]).map(b=>({title:tag(b,'title').replace(/<[^>]+>/g,'').replace(/\s+-\s+[^-]+$/,'').trim(),url:tag(b,'link'),source,date:tag(b,'pubDate')})).filter(x=>x.title)}
export default async function handler(){const settled=await Promise.allSettled(sources.map(async s=>{const q=s.domain?encodeURIComponent('site:'+s.domain):'';const url=s.direct||('https://news.google.com/rss/search?q='+q+'&hl=ar&gl=SA&ceid=SA:ar');const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});if(!r.ok)throw new Error('feed');return parse(await r.text(),s.name)}));const items=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);return new Response(JSON.stringify(items),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, s-maxage=120'}})}