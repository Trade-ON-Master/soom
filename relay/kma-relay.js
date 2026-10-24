// SOOM 날씨 중계기 (Cloudflare Worker)
// 기상청 날씨(예보·관측)와 에어코리아 미세먼지를 SOOM 화면에서 쓸 수 있게 대신 받아 줘요.
// 공공데이터포털 인증키는 여기에 적지 않아요. Worker의 Settings → Variables and Secrets에 이름 KMA_KEY, 종류 Secret으로 넣어요.
const ALLOWED = ['https://trade-on-master.github.io'];
const API = 'https://apis.data.go.kr';
const ROUTES = {
  '/vilage': '/1360000/VilageFcstInfoService_2.0/getVilageFcst', // 단기예보 (오늘~3일 뒤)
  '/ultra': '/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst', // 초단기예보 (앞으로 6시간)
  '/now': '/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', // 초단기실황 (지금, 최근 하루)
  '/asos': '/1360000/AsosHourlyInfoService/getWthrDataList', // 지상(종관, ASOS) 시간자료 (지난 날씨, 전날까지)
  '/air': '/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty', // 측정소별 실시간 미세먼지
  '/air-sido': '/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty', // 시도별 실시간 미세먼지
  '/air-fcst': '/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth', // 미세먼지 예보
};
// 지난 날씨는 바뀌지 않아서 더 오래 보관해요(초 단위). 나머지는 10분.
const KEEP = { '/asos': 3600 };
// 앞으로 SOOM이 기상청(1360000)·에어코리아(B552584)의 다른 서비스를 쓰게 되어도 이 코드를 다시 바꾸지 않아도 되도록:
// /svc/1360000/서비스이름/기능이름 처럼 부르면 그 서비스로 전달해요. 다른 기관의 서비스는 전달하지 않아요.
const SVC = /^\/svc(\/(?:1360000|B552584)\/[A-Za-z0-9_.]+\/[A-Za-z0-9_]+)$/;
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = { 'Access-Control-Allow-Origin': allowed ? origin : ALLOWED[0], 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response('SOOM relay OK v2' + (env.KMA_KEY ? '' : ' (KMA_KEY 비밀값이 아직 없어요)'), { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    const m = SVC.exec(url.pathname), path = ROUTES[url.pathname] || (m && m[1]);
    if (!path) return new Response('unknown', { status: 404, headers: cors });
    if (!allowed) return new Response('forbidden', { status: 403, headers: cors });
    if (!env.KMA_KEY) return new Response('KMA_KEY missing', { status: 500, headers: cors });
    const q = new URLSearchParams(url.search);
    q.delete('serviceKey'); q.delete('ServiceKey');
    const key = String(env.KMA_KEY).trim();
    q.set('serviceKey', key.includes('%') ? decodeURIComponent(key) : key); // works with either the Encoding or the Decoding key
    const res = await fetch(API + path + '?' + q.toString(), { cf: { cacheTtl: KEEP[url.pathname] || 600, cacheEverything: true } });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  },
};
