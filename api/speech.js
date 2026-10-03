export const config={runtime:'edge'};

const FALLBACK_VOICE='JBFqnCBsd6RMkjVDRZzb';

export default async function handler(req){
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'content-type':'application/json; charset=utf-8'}});
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key)return new Response(JSON.stringify({error:'ELEVENLABS_API_KEY is not configured'}),{status:500,headers:{'content-type':'application/json; charset=utf-8'}});
  try{
    const body=await req.json();
    const text=String(body?.text||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!text)return new Response(JSON.stringify({error:'Missing text'}),{status:400,headers:{'content-type':'application/json; charset=utf-8'}});
    const voiceId=process.env.ELEVENLABS_VOICE_ID||FALLBACK_VOICE;
    const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId)+'?output_format=mp3_44100_128',{
      method:'POST',
      headers:{'xi-api-key':key,'content-type':'application/json','accept':'audio/mpeg'},
      body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.55,similarity_boost:.75,style:.15,use_speaker_boost:true}})
    });
    if(!r.ok){
      const detail=await r.text();
      return new Response(JSON.stringify({error:'ElevenLabs request failed',status:r.status,detail:detail.slice(0,500)}),{status:r.status,headers:{'content-type':'application/json; charset=utf-8'}});
    }
    return new Response(r.body,{status:200,headers:{'content-type':'audio/mpeg','cache-control':'public, max-age=3600'}});
  }catch(e){
    return new Response(JSON.stringify({error:'Speech generation failed'}),{status:500,headers:{'content-type':'application/json; charset=utf-8'}});
  }
}
