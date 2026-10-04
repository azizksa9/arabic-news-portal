export const config={runtime:'edge'};
function stripMarks(s=''){return s.normalize('NFD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').normalize('NFC')}
export default async function handler(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const b=await req.json(),original=String(b?.text||'').replace(/\s+/g,' ').trim().slice(0,500);
  if(!original)return Response.json({text:''});
  const key=process.env.OPENAI_API_KEY;if(!key)return Response.json({text:original});
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-mini',input:'أضف التشكيل العربي المناسب إلى النص الآتي لتحسين النطق. ممنوع تغيير أي كلمة أو ترتيب أو رقم أو علامة ترقيم، وممنوع الشرح أو إعادة الصياغة. أعد النص نفسه فقط بعد إضافة الحركات. في الأسماء الأجنبية حافظ على الحروف نفسها واضبطها بما يساعد على النطق العربي.\n\n'+original,max_output_tokens:700})});
  if(!r.ok)return Response.json({text:original});
  const j=await r.json();let out=String(j.output_text||'').trim();
  if(!out){const p=[];for(const i of (j.output||[]))for(const c of (i.content||[]))if(typeof c.text==='string')p.push(c.text);out=p.join('').trim()}
  const a=stripMarks(original).replace(/\s+/g,' ').trim(),z=stripMarks(out).replace(/\s+/g,' ').trim();
  if(!out||a!==z)return Response.json({text:original});
  return new Response(JSON.stringify({text:out}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=86400'}});
 }catch{return Response.json({text:''})}
}