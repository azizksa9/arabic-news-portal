export const config={runtime:'edge'};
export default async function handler(req){
  try{
    const u=new URL(req.url),raw=u.searchParams.get('url');
    if(!raw)return new Response('missing',{status:400});
    const target=new URL(raw);
    if(target.protocol!=='https:'&&target.protocol!=='http:')return new Response('bad url',{status:400});
    const r=await fetch(target.toString(),{headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},redirect:'follow'});
    if(!r.ok)return new Response('image unavailable',{status:404});
    const type=r.headers.get('content-type')||'image/jpeg';
    if(!type.startsWith('image/'))return new Response('not image',{status:415});
    return new Response(r.body,{headers:{'content-type':type,'cache-control':'public, max-age=3600'}});
  }catch{return new Response('image error',{status:500})}
}