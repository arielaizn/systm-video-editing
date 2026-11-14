#!/usr/bin/env node
// SYSTM Depth board: every depth project's timeline in the browser, with live render progress.
//   node engine/depth/board.mjs [--port 4466]     then open http://localhost:4466
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';

const ROOT = path.join(os.homedir(), 'content-os');
const PROJ = path.join(ROOT, 'projects');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4466;
const rj = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const count = (d) => { try { return fs.readdirSync(d).filter((f) => f.endsWith('.png')).length; } catch { return 0; } };

function state() {
  const out = [];
  for (const id of fs.existsSync(PROJ) ? fs.readdirSync(PROJ).sort((a, b) => { const m = (x) => { try { return fs.statSync(path.join(PROJ, x, 'edit', 'depth', 'plan.json')).mtimeMs; } catch { return 0; } }; return m(b) - m(a); }) : []) {
    const dd = path.join(PROJ, id, 'edit', 'depth');
    const plan = rj(path.join(dd, 'plan.json')); if (!plan) continue;
    const fps = 30, total = Math.round((plan.duration || 0) * fps);
    const passes = {}; for (const p of ['world', 'presenter', 'front', 'text']) passes[p] = count(path.join(dd, 'frames', p));
    const words = rj(path.join(dd, 'words.json'), []);
    const videos = fs.readdirSync(dd).filter((f) => /^depth-(v\d+|preview)\.mp4$/.test(f)).sort();
    const sfx = rj(path.join(dd, 'sfx.json'), []);
    const layersDir = path.join(dd, 'layers');
    const beats = (plan.beats || []).map((b) => ({ ...b, layers: (b.layers || []).map((l) => {
      const f = l.file || path.join(layersDir, `${l.reuse || `${b.id}-${l.id}`}.png`);
      return { ...l, img: fs.existsSync(f) ? `/file?p=${encodeURIComponent(f)}` : null };
    }) }));
    const last = passes.world ? `/file?p=${encodeURIComponent(path.join(dd, 'frames', 'world', String(passes.world).padStart(5, '0') + '.png'))}` : null;
    out.push({ id, world: plan.world, duration: plan.duration, total, passes, beats, words, sfx, last,
      videos: videos.map((v) => ({ name: v, url: `/file?p=${encodeURIComponent(path.join(dd, v))}` })) });
  }
  return out;
}

const PAGE = fs.readFileSync(new URL('./board.html', import.meta.url), 'utf8');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/state') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(state())); }
  if (u.pathname === '/file') {
    const p = path.resolve(u.searchParams.get('p') || '');
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p).toLowerCase();
    const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' }[ext] || 'application/octet-stream';
    const st = fs.statSync(p); const range = req.headers.range;
    if (range && ext === '.mp4') {
      const [a, b] = range.replace('bytes=', '').split('-'); const s = Number(a), e = b ? Number(b) : st.size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${s}-${e}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 });
      return fs.createReadStream(p, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': ext === '.png' ? 'max-age=60' : 'no-cache' });
    return fs.createReadStream(p).pipe(res);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(PAGE.replaceAll('__FONTS__', `/file?p=${encodeURIComponent(path.join(ROOT, 'brand', 'fonts'))}`));
}).listen(port, () => console.log(`depth board: http://localhost:${port}`));
