export const config={runtime:'edge'};
const allowed=new Set(['vt.tiktok.com','vm.tiktok.com','www.tiktok.com','tiktok.com']);
export default async function handler(req){
  try{
    const u=new URL(req.url),raw=u.searchParams.get('url')||'';
    const x=new URL(raw);
    if(!allowed.has(x.hostname))throw new Error('bad_url');
    const r=await fetch(x.toString(),{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'}});
    const final=r.url||x.toString();
    const m=final.match(/\/video\/(\d+)/);
    if(!m)return new Response(JSON.stringify({error:'no_video_id',final}),{status:422,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({id:m[1],url:final,embed:'https://www.tiktok.com/player/v1/'+m[1]+'?autoplay=1&loop=0'}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
  }catch(e){return new Response(JSON.stringify({error:String(e?.message||e)}),{status:400,headers:{'content-type':'application/json'}})}
}