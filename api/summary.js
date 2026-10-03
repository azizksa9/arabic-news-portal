export const config={runtime:'edge'};
function dec(s=''){let x=s.replace(/<!\[CDATA\[|\]\]>/g,'');for(let i=0;i<3;i++)x=x.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;|&#160;|&#xA0;/gi,' ');return x}
function txt(s=''){return dec(s).replace(/<[^>]+>/g,' ').replace(/&[a-zA-Z0-9#]+;/g,' ').replace(/\s+/g,' ').trim()}
function meta(h,key){const tags=h.match(/<meta\b[^>]*>/gi)||[];for(const t of tags){const k=(t.match(/(?:property|name)=["']([^"']+)["']/i)||[])[1];if(k!==key)continue;const v=(t.match(/content=["']([^"']*)["']/i)||[])[1];if(v)return txt(v)}return''}
function objects(v,out=[]){if(!v||typeof v!=='object')return out;if(Array.isArray(v)){v.forEach(x=>objects(x,out));return out}out.push(v);Object.values(v).forEach(x=>objects(x,out));return out}
function articleData(h){for(const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{for(const o of objects(JSON.parse(m[1]))){if(o&&(o.articleBody||o.description)){const body=txt(o.articleBody||o.description);if(body.split(/\s+/).length>=25)return body}}}catch{}}return''}
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
export default async function handler(req){try{const u=new URL(req.url),raw=u.searchParams.get('url')||'',title=u.searchParams.get('title')||'';if(!raw)return Response.json({summary:''});const target=new URL(raw);if(!/^https?:$/.test(target.protocol))return Response.json({summary:''});const r=await fetch(target.toString(),{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'},redirect:'follow',cache:'no-store'});if(!r.ok)return Response.json({summary:''});const h=await r.text();let body=articleData(h)||paragraphBody(h,title);if(!body||body.split(/\s+/).length<35)return Response.json({summary:''});return new Response(JSON.stringify({summary:summarize(title,body)}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}catch{return Response.json({summary:''})}}