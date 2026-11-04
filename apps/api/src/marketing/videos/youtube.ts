// El id de un video de YouTube a partir de su link (youtu.be/…, youtube.com/watch?v=…, /shorts/…, /embed/…) o del id
// suelto. Los tutoriales se guardan por id: el panel arma el reproductor con youtube-nocookie.com.

const ID = /^[\w-]{11}$/;

export function idDeYoutube(valor: string): string | null {
  const v = valor.trim();
  if (ID.test(v)) return v;
  let url: URL;
  try {
    url = new URL(v.startsWith('http') ? v : `https://${v}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}
