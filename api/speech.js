export const config={runtime:'edge'};

const VOICE='ar-SA-HamedNeural';

function esc(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

async function edgeSpeech(text){
  const endpoint='https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  const ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="'+VOICE+'"><prosody rate="-3%" pitch="+0Hz">'+esc(text)+'</prosody></voice></speak>';
  const r=await fetch(endpoint,{
    method:'POST',
    headers:{
      'Content-Type':'application/ssml+xml',
      'X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent':'Mozilla/5.0',
      'Accept':'audio/mpeg'
    },
    body:ssml
  });
  if(!r.ok) throw new Error('Edge TTS '+r.status);
  return r;
}

export default async function handler(req){
  if(req.method!=='POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'content-type':'application/json; charset=utf-8'}});
  try{
    const body=await req.json();
    const text=String(body?.text||'').replace(/\s+/g,' ').trim().slice(0,1400);
    if(!text) return new Response(JSON.stringify({error:'Missing text'}),{status:400,headers:{'content-type':'application/json; charset=utf-8'}});
    const r=await edgeSpeech(text);
    return new Response(r.body,{status:200,headers:{
      'content-type':'audio/mpeg',
      'cache-control':'public, s-maxage=604800, stale-while-revalidate=2592000',
      'x-tts-voice':VOICE
    }});
  }catch(e){
    return new Response(JSON.stringify({error:'Speech generation failed',detail:String(e?.message||e)}),{status:502,headers:{'content-type':'application/json; charset=utf-8'}});
  }
}
