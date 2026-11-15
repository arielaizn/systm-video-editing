#!/usr/bin/env node
// SYSTM Depth: the "image pieces in 3D space" edit. No video model: Codex (image_gen) paints the layers of every beat,
// Apple Vision cuts the presenter out, Blender assembles everything as planes in depth and flies a camera through it.
//   node engine/depth/depth.mjs <command> <project> [options]
//   init     [--src file] [--rotate cw|ccw|180]  normalized src.mp4 (1080x1920@30) + words.json + plan.json skeleton
//   matte    [--fast]                            presenter mattes (Apple Vision) -> edit/depth/matte/
//   check                                        validate plan.json, print the beat table
//   layers   [--jobs 3] [--only b2] [--redo b2-hero]  paint missing layers with Codex -> edit/depth/layers/ + sheet
//   text                                         titles, captions and CTA as PNGs (SYSTM Display V2, RTL) -> edit/depth/text/
//   autoplan [--look name]                       Claude writes plan.json by itself (systm-depth-plan skill), a look not used recently
//   words                                        transcribe src.mp4 itself (exact word times on the cut)
//   stills   [--preview] [--at 3.2,8]           frames (all 4 passes stacked) -> edit/depth/stills/sheet.jpg
//   finish   [--preview] [--no-sfx]              stack passes, grade, voice + SFX + music bed (sound bank) -> depth-vN.mp4
//   open     [--frame N]                         save edit/depth/scene.blend and open it in Blender with the timeline
//   render   [--preview] [--from s] [--to s]     Blender (Eevee) -> edit/depth/frames/
//   finish   [--preview]                         grade + audio -> edit/depth/depth-v<N>.mp4 (and the review version)
//   run      [--preview]                         layers, text, render, finish
// Everything lives in projects/<project>/edit/depth/. The plan is written by Claude (skill systm-depth-plan).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const P = (...a) => path.join(ROOT, ...a);
const BLENDER = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const FPS = 30, W = 1080, H = 1920;
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const sh = (cmd, args, opt = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...opt });
const log = (m) => { const l = `[${new Date().toISOString()}] depth: ${m}`; console.log(l); fs.mkdirSync(P('logs'), { recursive: true }); fs.appendFileSync(P('logs', 'engine.log'), l + '\n'); };
const die = (m) => { console.error('depth: ' + m); process.exit(1); };
const opt = (args, k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const STYLE = readJson(path.join(HERE, 'style.json'));

function projDir(name) {
  if (!name) die('missing project name');
  const d = fs.existsSync(name) && fs.statSync(name).isDirectory() ? path.resolve(name) : P('projects', name);
  if (!fs.existsSync(d)) die(`project not found: ${name}`);
  return d;
}
const D = (dir, ...a) => path.join(dir, 'edit', 'depth', ...a);
const duration = (f) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());
const planOf = (dir) => { const p = readJson(D(dir, 'plan.json')); if (!p) die('edit/depth/plan.json missing (run init, then write the plan)'); return p; };

// ---------- init ----------
function init(dir, args) {
  fs.mkdirSync(D(dir), { recursive: true });
  const meta = readJson(path.join(dir, 'meta.json'));
  const rough = path.join(dir, 'edit', 'rough.mp4');
  const src = opt(args, '--src', fs.existsSync(rough) ? rough : meta ? path.join(dir, 'raw', meta.clips[0].file) : null);
  if (!src || !fs.existsSync(src)) die('no source video: run cos cut first, or pass --src');
  const rot = { cw: 'transpose=1,', ccw: 'transpose=2,', 180: 'hflip,vflip,' }[opt(args, '--rotate', '')] || '';
  const out = D(dir, 'src.mp4');
  sh('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', `${rot}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-g', '15', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out]);
  // words on the src timeline
  let words = null;
  if (path.resolve(src) === path.resolve(rough)) words = readJson(path.join(dir, 'edit', 'words.json'));
  else if (meta && path.resolve(src) === path.resolve(path.join(dir, 'raw', meta.clips[0].file))) words = readJson(path.join(dir, 'work', 'transcript.json'))?.words;
  if (!words) log('no word timings for this source: captions are off until edit/depth/words.json exists');
  else writeJson(D(dir, 'words.json'), words);
  const dur = +duration(out).toFixed(3);
  if (!fs.existsSync(D(dir, 'plan.json'))) writeJson(D(dir, 'plan.json'), { duration: dur, world: 'studio', keywords: [], captions: true, beats: [] });
  else { const p = readJson(D(dir, 'plan.json')); p.duration = dur; writeJson(D(dir, 'plan.json'), p); }
  // a readable transcript for planning: one line per sentence, with times
  if (words) {
    const lines = []; let cur = [];
    words.forEach((w, i) => { cur.push(w); const n = words[i + 1]; if (!n || /[.?!…,]$/.test(w.t) || n.s - w.e > 0.45) { lines.push(`${cur[0].s.toFixed(2)}-${cur.at(-1).e.toFixed(2)}  ${cur.map((x) => x.t).join(' ')}`); cur = []; } });
    fs.writeFileSync(D(dir, 'transcript.txt'), lines.join('\n') + '\n');
  }
  log(`init ${path.basename(dir)}: src.mp4 ${dur}s${words ? `, ${words.length} words` : ''}`);
  console.log(D(dir, 'plan.json'));
}

// ---------- matte ----------
function matte(dir, args) {
  const bin = path.join(HERE, 'matte');
  if (!fs.existsSync(bin)) sh('swiftc', ['-O', path.join(HERE, 'matte.swift'), '-o', bin]);
  const frames = D(dir, '_frames'); const out = D(dir, 'matte');
  fs.mkdirSync(frames, { recursive: true });
  const want = Math.round(duration(D(dir, 'src.mp4')) * FPS);
  const have = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.endsWith('.png')).length : 0;
  if (have >= want - 1) { console.log(`mattes ready (${have})`); return; }
  sh('ffmpeg', ['-y', '-v', 'error', '-i', D(dir, 'src.mp4'), '-vf', 'scale=720:1280', '-q:v', '3', path.join(frames, '%05d.jpg')]);
  log(`matte ${path.basename(dir)}: ${want} frames`);
  const r = spawnSync(bin, ['person', frames, out, args.includes('--fast') ? 'balanced' : 'accurate'], { stdio: 'inherit' });
  fs.rmSync(frames, { recursive: true, force: true });
  if (r.status) die('matte failed');
}

// ---------- check ----------
function validate(dir) {
  const p = planOf(dir); const errs = []; const warn = [];
  if (p.look && !STYLE.looks?.[p.look]) errs.push(`look "${p.look}" is not in style.json looks`);
  if (!STYLE.worlds[p.world] && !p.worldLook) errs.push(`world "${p.world}" is not in style.json and there is no worldLook`);
  if (!p.beats?.length) errs.push('no beats');
  let t = 0;
  (p.beats || []).forEach((b, i) => {
    if (!b.id) errs.push(`beat ${i} has no id`);
    if (Math.abs(b.start - t) > 0.05) errs.push(`${b.id}: starts at ${b.start}, expected ${t.toFixed(2)} (beats must be back to back)`);
    if (!(b.end > b.start)) errs.push(`${b.id}: end <= start`);
    if (b.end - b.start < 0.8) warn.push(`${b.id}: shorter than 0.8s`);
    if (b.end - b.start > 8) warn.push(`${b.id}: longer than 8s, the brand wants a change every 8s at most`);
    t = b.end;
    const ids = new Set();
    for (const l of b.layers || []) {
      if (!l.id || ids.has(l.id)) errs.push(`${b.id}: layer without id or duplicate id ${l.id}`); ids.add(l.id);
      if (!STYLE.roles[l.role]) errs.push(`${b.id}-${l.id}: role "${l.role}" unknown`);
      if (!l.prompt && !l.file && !l.reuse) errs.push(`${b.id}-${l.id}: needs prompt, file or reuse`);
    }
    if (b.presenter !== 'full' && !(b.layers || []).some((l) => l.role === 'bg')) errs.push(`${b.id}: no bg layer`);
  });
  if (p.duration && Math.abs(t - p.duration) > 0.1) errs.push(`beats end at ${t.toFixed(2)}, video is ${p.duration}s`);
  return { p, errs, warn };
}
function check(dir) {
  const { p, errs, warn } = validate(dir);
  for (const b of p.beats || []) console.log(`${b.id.padEnd(4)} ${b.start.toFixed(2)}-${b.end.toFixed(2)}  ${String(b.presenter || 'bottom').padEnd(6)} ${String(b.camera?.move || 'push').padEnd(11)} ${String(b.transition || 'cut').padEnd(5)} ${(b.layers || []).map((l) => `${l.id}:${l.role}${layerFile(dir, b, l) && fs.existsSync(layerFile(dir, b, l)) ? '' : '*'}`).join(' ')}  ${b.title?.text || ''}`);
  for (const w of warn) console.log('warn: ' + w);
  for (const e of errs) console.log('ERROR: ' + e);
  console.log(errs.length ? `${errs.length} errors` : 'plan ok (* = layer not painted yet)');
  if (errs.length) process.exitCode = 1;
  return errs.length === 0;
}
function layerFile(dir, b, l) {
  if (l.file) return path.isAbsolute(l.file) ? l.file : path.join(dir, l.file);
  if (l.reuse) return D(dir, 'layers', `${l.reuse}.png`);
  return D(dir, 'layers', `${b.id}-${l.id}.png`);
}

// ---------- layers (Codex image_gen) ----------
const codexHome = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
function newestImage(d, since) {
  if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).filter((x) => /\.(png|jpe?g|webp)$/i.test(x)).map((x) => ({ x, t: fs.statSync(path.join(d, x)).mtimeMs })).filter((o) => o.t >= since - 2000).sort((a, b) => b.t - a.t)[0];
  return f ? path.join(d, f.x) : null;
}
function codexImage({ prompt, out, refs = [], aspect, transparent }) {
  return new Promise((resolve, reject) => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'depth-img-')); const started = Date.now();
    const text = [
      'Use the built-in image generation tool (image_gen) to generate exactly ONE image. Do not use any other tool and do not write any files.',
      refs.length ? 'The attached image is the STYLE ANCHOR of this video: match its lighting, palette, color grade, grain and material rendering exactly. Do NOT copy its content or composition.' : '',
      `Aspect ratio: ${aspect}.`,
      transparent ? 'The output MUST have a transparent background (real alpha channel).' : '',
      'IMAGE PROMPT:', prompt, 'When finished, reply with the single word DONE.',
    ].filter(Boolean).join('\n');
    const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'workspace-write', '--ephemeral'];
    for (const r of refs) args.push('-i', r);
    args.push('-');
    const ch = spawn('codex', args, { cwd: work, env: { ...process.env, PATH: `${os.homedir()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', tid = null, err = '';
    const to = setTimeout(() => ch.kill('SIGKILL'), 10 * 60e3);
    ch.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const j = JSON.parse(line); if (j.type === 'thread.started') tid = j.thread_id; } catch {} } });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('error', (e) => { clearTimeout(to); reject(e); });
    ch.on('close', () => {
      clearTimeout(to); fs.rmSync(work, { recursive: true, force: true });
      const found = tid && newestImage(path.join(codexHome(), 'generated_images', tid), started);
      if (!found) return reject(new Error('Codex returned no image' + (err ? ': ' + err.split('\n').filter((l) => !/rmcp|mcp/i.test(l)).join(' ').slice(-300) : '')));
      fs.mkdirSync(path.dirname(out), { recursive: true }); fs.copyFileSync(found, out); resolve(out);
    });
    ch.stdin.end(text);
  });
}
// trim transparent margins, report alpha coverage; lift the subject with Vision when the model gave no alpha
const PY_ALPHA = `
import sys
from PIL import Image
f=sys.argv[1]; im=Image.open(f).convert('RGBA'); a=im.getchannel('A')
hist=a.histogram(); n=im.size[0]*im.size[1]; clear=sum(hist[:10])/n
if clear>0.03:
    bb=a.point(lambda v:255 if v>8 else 0).getbbox()
    if bb:
        pad=int(0.02*max(im.size)); bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(im.size[0],bb[2]+pad),min(im.size[1],bb[3]+pad))
        im=im.crop(bb); im.save(f)
print(f"{clear:.3f} {im.size[0]} {im.size[1]}")
`;
const alphaInfo = (f) => { const [clear, w, h] = sh('python3', ['-c', PY_ALPHA, f]).trim().split(' ').map(Number); return { clear, w, h }; };

function layerPrompt(p, l) {
  const world = p.worldLook || STYLE.worlds[p.world];
  const look = STYLE.looks?.[p.look];
  return [STYLE.base, look ? `Art direction of this video (${look.name}): ${look.art}` : '', `World of this video: ${world}`, STYLE.roles[l.role], l.prompt].join('\n');
}
async function layers(dir, args) {
  const { p, errs } = validate(dir); if (errs.length) { check(dir); die('fix the plan first'); }
  const only = opt(args, '--only', null); const redo = new Set(String(opt(args, '--redo', '')).split(',').filter(Boolean));
  const jobs = Number(opt(args, '--jobs', 3));
  const todo = [];
  for (const b of p.beats) for (const l of b.layers || []) {
    if (l.file || l.reuse) continue;
    if (only && b.id !== only) continue;
    const out = layerFile(dir, b, l);
    if (fs.existsSync(out) && !redo.has(`${b.id}-${l.id}`)) continue;
    todo.push({ b, l, out });
  }
  if (!todo.length) { console.log('all layers painted'); return sheetLayers(dir, p); }
  // the style anchor: the first bg of the video, painted first, then passed to every other layer
  const anchor = D(dir, 'layers', `${p.beats.find((b) => (b.layers || []).some((l) => l.role === 'bg'))?.id}-${p.beats.flatMap((b) => b.layers || []).find((l) => l.role === 'bg')?.id}.png`);
  const one = async ({ b, l, out }) => {
    const transparent = l.role !== 'bg';
    const aspect = l.aspect || (l.role === 'bg' ? 'tall vertical portrait 9:16 (or the tallest portrait size available)' : 'square 1:1');
    // objects get the anchor for light and grade; backgrounds only when asked (the model copies its composition otherwise)
    const useAnchor = l.anchor ?? (l.role !== 'bg');
    const refs = out !== anchor && fs.existsSync(anchor) && useAnchor ? [anchor] : [];
    // a state image (cracked, infected, lit...) is painted FROM its original, so it is the same object in a new state
    if (l.ref) { const rf = D(dir, 'layers', `${l.ref.includes('-') ? l.ref : `${b.id}-${l.ref}`}.png`); if (fs.existsSync(rf)) refs.unshift(rf); }
    const t0 = Date.now();
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await codexImage({ prompt: layerPrompt(p, l), out, refs, aspect, transparent });
        if (transparent) {
          let a = alphaInfo(out);
          if (a.clear < 0.03) { // no alpha came back: cut the subject out with Apple Vision
            const bin = path.join(HERE, 'matte'); if (!fs.existsSync(bin)) sh('swiftc', ['-O', path.join(HERE, 'matte.swift'), '-o', bin]);
            sh(bin, ['lift', out, out]); a = alphaInfo(out);
          }
        }
        log(`layer ${b.id}-${l.id} ok (${Math.round((Date.now() - t0) / 1000)}s)`); return;
      } catch (e) { log(`layer ${b.id}-${l.id} attempt ${attempt} failed: ${e.message}`); }
    }
    throw new Error(`layer ${b.id}-${l.id} failed twice`);
  };
  log(`layers ${path.basename(dir)}: ${todo.length} to paint, ${jobs} at a time`);
  const first = todo.find((x) => x.out === anchor);
  if (first) await one(first);
  const failed = [];
  const wave = async (list) => { let i = 0; await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, async () => { while (i < list.length) { const x = list[i++]; await one(x).catch((e) => failed.push(e.message)); } })); };
  await wave(todo.filter((x) => x !== first && !x.l.ref));
  await wave(todo.filter((x) => x !== first && x.l.ref));
  sheetLayers(dir, p);
  if (failed.length) die(failed.join('\n'));
}
function sheetLayers(dir, p) {
  const files = p.beats.flatMap((b) => (b.layers || []).map((l) => layerFile(dir, b, l))).filter((f) => fs.existsSync(f));
  if (!files.length) return;
  const out = D(dir, 'layers', 'sheet.jpg');
  // transparent layers on a mid grey, so cut-out edges and halos are visible; the file name under each tile
  sh('python3', ['-c', `
import sys, os
from PIL import Image, ImageDraw
files = sys.argv[2:]; T = 300; cols = min(6, len(files)); rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * T, rows * (T + 22)), (16, 22, 25)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA'); im.thumbnail((T - 8, T - 8))
    tile = Image.new('RGBA', (T, T), (96, 102, 104, 255)); tile.alpha_composite(im, ((T - im.size[0]) // 2, (T - im.size[1]) // 2))
    x, y = (i % cols) * T, (i // cols) * (T + 22); sheet.paste(tile.convert('RGB'), (x, y)); d.text((x + 6, y + T + 4), os.path.basename(f)[:-4], fill=(245, 247, 247))
sheet.save(sys.argv[1], quality=85)`, out, ...files]);
  console.log(out);
}

// ---------- text (Playwright, SYSTM Display V2, RTL) ----------
function captionGroups(p, words) {
  const kw = (p.keywords || []).map((k) => k.replace(/[^\p{L}\p{N}]/gu, ''));
  const gs = []; let cur = [];
  const flush = () => { if (cur.length) gs.push(cur); cur = []; };
  words.forEach((w, i) => {
    cur.push(w); const n = words[i + 1];
    const chars = cur.map((x) => x.t).join(' ').length;
    if (!n || /[.?!…,:]$/.test(w.t) || n.s - w.e > 0.35 || cur.length >= 3 || chars >= 15) flush();
  });
  return gs.map((g, i) => {
    const clean = g.map((w) => w.t.replace(/[.,?!…:;"]+$/g, ''));
    const hit = clean.findIndex((t) => kw.some((k) => k && t.replace(/[^\p{L}\p{N}]/gu, '').includes(k)));
    return { id: `c${String(i + 1).padStart(3, '0')}`, words: clean, accent: hit, s: g[0].s, e: g.at(-1).e };
  });
}
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_DIR, path.join(ROOT, 'node_modules'), path.join(ROOT, 'engine', 'node_modules')].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(t, 'x.js'))('playwright'); } catch {} }
  die('playwright not found (set PLAYWRIGHT_DIR to a node_modules that has it)');
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const norm = (s) => String(s).replace(/[^\p{L}\p{N}]/gu, '');
async function text(dir) {
  const { p, errs } = validate(dir); if (errs.length) die('fix the plan first');
  const out = D(dir, 'text'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const fonts = P('brand', 'fonts');
  // SYSTM Display V2: the brand's video font (Black for titles, ExtraBold for captions)
  const ff = (w, f, fmt) => `@font-face{font-family:S;font-weight:${w};src:url(data:font/${fmt};base64,${fs.readFileSync(path.join(fonts, f)).toString('base64')}) format('${fmt === 'ttf' ? 'truetype' : 'woff2'}')}`;
  const css = `${ff(900, 'SYSTMDisplayV2-Black.ttf', 'ttf')}${ff(800, 'SYSTMDisplayV2-ExtraBold.woff2', 'woff2')}${ff(700, 'SYSTMDisplayV2-Bold.woff2', 'woff2')}${ff(500, 'SYSTMDisplayV2-Medium.woff2', 'woff2')}
  html,body{margin:0;background:transparent}#s{display:inline-block;padding:30px 44px;direction:rtl;text-align:center;font-family:S}
  .t{font-weight:900;color:#f5f7f7;font-size:var(--fs);line-height:1.04;letter-spacing:-.01em;max-width:1040px;text-shadow:0 4px 26px rgba(0,0,0,.6)}
  .c{font-weight:800;color:#f5f7f7;font-size:var(--fs);line-height:1.1;text-shadow:0 3px 18px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.5)}
  .k{font-weight:500;color:rgba(245,247,247,.8);font-size:48px;margin-bottom:6px;text-shadow:0 2px 14px rgba(0,0,0,.6)}
  .ice{color:#acf4f8}.ghost{visibility:hidden}
  .pill{display:inline-block;margin-top:18px;background:#acf4f8;color:#080c0e;border-radius:999px;padding:8px 56px 14px;font-weight:900;font-size:108px;text-shadow:none;box-shadow:0 10px 40px rgba(172,244,248,.25)}`;
  // every state of a line is rendered with the full line laid out and the not-yet-said words hidden,
  // so words never jump while the line builds (RTL, centered)
  const lineHtml = (words, n, accent, cls, fs_, hot) => `<div class="${cls}" style="--fs:${fs_}px">${words.map((w, i) => `<span class="${[i === accent || hot ? 'ice' : '', i >= n ? 'ghost' : ''].join(' ')}">${esc(w)}</span>`).join(' ')}</div>`;
  const items = []; const titles = {};
  for (const b of p.beats) {
    const tt = b.title; if (!tt?.text && !tt?.pill) continue;
    const ws = (tt.text || '').split(/\s+/).filter(Boolean);
    const acc = tt.accent ? Math.max(ws.findIndex((w) => norm(w) === norm(tt.accent)), ws.findIndex((w) => norm(w).includes(norm(tt.accent)))) : -1;
    const n = tt.build === false ? 1 : Math.max(1, ws.length);
    titles[b.id] = [];
    // hot accent (from the references): the line builds in Ice, then cools to white and only the key word stays Ice
    const hot = tt.hot ?? p.hotTitles ?? true;
    for (let k = 1; k <= n + (hot ? 1 : 0); k++) {
      const shown = tt.build === false || k > n ? ws.length : k;
      const last = k >= n;
      const html = `${tt.kicker ? `<div class="k">${esc(tt.kicker)}</div>` : ''}${ws.length ? lineHtml(ws, shown, acc, 't', tt.size || STYLE.looks?.[p.look]?.titleSize || 112, hot && k <= n) : ''}${tt.pill ? `<div class="${last ? '' : 'ghost'}"><span class="pill">${esc(tt.pill)}</span></div>` : ''}`;
      const id = `title-${b.id}-${k}`; items.push({ id, html }); titles[b.id].push(id);
    }
  }
  const words = readJson(D(dir, 'words.json'));
  const caps = p.captions !== false && words ? captionGroups(p, words) : [];
  for (const c of caps) { c.states = []; c.words.forEach((_, k) => { const id = `${c.id}-${k + 1}`; items.push({ id, html: lineHtml(c.words, k + 1, c.accent, 'c', 64) }); c.states.push(id); }); }
  const pw = loadPlaywright();
  const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const browser = await pw.chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: W, height: 1200 }, deviceScaleFactor: 1 });
  const index = {};
  for (const it of items) {
    await page.setContent(`<html><head><style>${css}</style></head><body><div id="s">${it.html}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$('#s'); const bb = await el.boundingBox();
    const f = path.join(out, `${it.id}.png`);
    await el.screenshot({ path: f, omitBackground: true });
    index[it.id] = { file: f, w: Math.round(bb.width), h: Math.round(bb.height) };
  }
  await browser.close();
  writeJson(path.join(out, 'index.json'), { items: index, captions: caps, titles });
  log(`text ${path.basename(dir)}: ${items.length} images (${caps.length} caption lines), SYSTM Display V2`);
}

// ---------- scene + render ----------
const ROLE_ORDER = ['bg', 'mid', 'title', 'card', 'hero', 'fg', 'actor'];
function sceneJson(dir, { preview }) {
  const { p, errs } = validate(dir); if (errs.length) { check(dir); die('fix the plan first'); }
  const tx = readJson(D(dir, 'text', 'index.json'), { items: {}, captions: [], titles: {} });
  const words = readJson(D(dir, 'words.json'), []);
  const def = STYLE.defaults.depth;
  const LOOK = STYLE.looks?.[p.look] || {};
  const fr = (s) => Math.round(s * FPS) + 1; // Blender frames are 1-based
  const beats = p.beats.map((b, bi) => {
    const f0 = fr(b.start), f1 = fr(b.end) - 1;
    const solo = b.presenter === 'none';
    const byId = Object.fromEntries((b.layers || []).map((l) => [l.id, l]));
    const layers = (b.layers || []).filter((l) => !l.hidden).map((l) => {
      const file = layerFile(dir, b, l);
      if (!fs.existsSync(file)) die(`layer missing: ${path.relative(dir, file)} (run layers)`);
      // default layout (fractions from the top): title 12-25%, hero 26-51%, speaker's head from 52%, caption on the chest at 77%
      const yDef = { hero: solo ? -0.02 : 0.24, card: solo ? -0.02 : 0.24 }[l.role] ?? 0;
      const hDef = { bg: 0, mid: 0.7, hero: solo ? 0.4 : 0.25, card: solo ? 0.4 : 0.26, fg: 0.5, actor: 0.075 }[l.role];
      return { id: `${b.id}-${l.id}`, role: l.role, file, z: l.z ?? def[l.role], x: l.x ?? 0, y: l.y ?? yDef, h: l.h ?? hDef,
        anim: l.anim || (l.role === 'actor' ? 'fade' : l.role === 'hero' ? 'pop' : l.role === 'card' ? 'flip' : l.role === 'bg' ? 'none' : l.role === 'fg' ? 'slide-left' : 'rise'),
        at: fr(b.start + (l.at || 0)), out: l.out != null ? fr(b.start + l.out) : null, spin: l.spin || 0, tilt: l.tilt || 0, roll: l.roll || 0,
        gain: l.gain ?? 1, float: l.float ?? (l.role === 'hero' || l.role === 'card'), front: l.front ?? (l.role === 'fg' || l.role === 'actor'),
        // actions (from the references): a path the layer travels (the actor cursor), clicks, a knock that sends it falling,
        // a state change to another painted image, a swarm of copies flying at the lens
        path: l.path?.map((q) => ({ f: fr(b.start + q.t), x: q.x, y: q.y, click: !!q.click })) || null,
        knock: l.knock ? { f: fr(b.start + l.knock.at), dir: l.knock.dir || 1, follow: !!l.knock.follow } : null,
        swap: l.swap ? { f: fr(b.start + l.swap.at), file: layerFile(dir, b, byId[l.swap.layer] || { id: l.swap.layer }), glow: l.swap.glow ?? 0.35 } : null,
        swarm: l.swarm || 0 };
    });
    // title: one state per word, each landing on the spoken word when it is said in this beat, else staggered
    let title = null;
    const states = tx.titles?.[b.id];
    if (states?.length) {
      const tt = b.title; const ws = (tt.text || '').split(/\s+/).filter(Boolean);
      const spoken = words.filter((w) => w.s >= b.start - 0.1 && w.s < b.end);
      let t = b.start + (tt.at || 0); const times = [];
      states.forEach((_, k) => {
        const w = ws[k] && spoken.find((x) => norm(x.t).length >= 2 && (norm(x.t).includes(norm(ws[k])) || norm(ws[k]).includes(norm(x.t))) && x.s >= t - 0.05);
        t = k >= ws.length && k > 0 ? t + 0.45 : w && k > 0 ? Math.max(t + 0.12, w.s) : k === 0 ? t : t + 0.22;
        times.push(Math.min(t, b.end - 0.2));
      });
      title = { space: tt.space || (b.presenter === 'full' ? 'screen' : 'world'), z: tt.z ?? def.title, y: tt.y ?? LOOK.titleY ?? STYLE.defaults.titleY,
        states: states.map((id, k) => ({ ...tx.items[id], f: fr(times[k]) })) };
    }
    const hero = layers.find((l) => l.role === 'hero') || layers.find((l) => l.role === 'card');
    return { id: b.id, label: b.title?.text || '', f0, f1, presenter: b.presenter || 'bottom', zoom: b.zoom || 1,
      camera: { move: b.camera?.move || 'push', amount: (b.camera?.amount ?? 1) * (LOOK.motion ?? 1) }, transition: b.transition || 'cut', next: p.beats[bi + 1]?.transition || 'cut',
      fstop: b.fstop ?? LOOK.fstop ?? STYLE.defaults.fstop, focus: b.focus ?? (hero ? hero.z : def.hero), layers: layers.sort((a, c) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(c.role)), title };
  });
  const frames = Math.round(p.duration * FPS);
  const caps = (tx.captions || []).map((c, i, all) => {
    const f1 = Math.min(fr(all[i + 1]?.s ?? c.e + 0.4) - 1, fr(c.e + 0.6));
    const ws = words.filter((w) => w.s >= c.s - 0.01 && w.s <= c.e + 0.01);
    return { f1, states: c.states.map((id, k) => ({ ...tx.items[id], f: Math.min(f1, fr(ws[k]?.s ?? c.s + k * 0.25)) })) };
  });
  const nm = fs.existsSync(D(dir, 'matte')) ? fs.readdirSync(D(dir, 'matte')).filter((f) => f.endsWith('.png')).length : 0;
  if (beats.some((b) => b.presenter === 'bottom') && !nm) die('presenter mattes missing (run matte)');
  return { fps: FPS, width: W, height: H, frames, preview: !!preview, lens: 35, sensor: 36, presenter: nm ? framing(dir, p) : null, captionY: p.captionY ?? STYLE.defaults.captionY, src: D(dir, 'src.mp4'), matteDir: D(dir, 'matte'), matteCount: nm, beats, captions: caps };
}
// where the person sits in the source (median box over the mattes), and the scale that puts the top of the head
// at presenterTop of the frame with the body running off the bottom edge, centered
function framing(dir, p) {
  const cache = D(dir, 'framing.json');
  let box = readJson(cache);
  if (!box || box.head == null) {
    box = JSON.parse(sh('python3', ['-c', `
import sys, os, json
from PIL import Image
d = sys.argv[1]; fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))[::15]
T, B, CX, HW = [], [], [], []
for f in fs:
    m = Image.open(os.path.join(d, f)).convert('L'); w, h = m.size
    b = m.point(lambda v: 255 if v > 128 else 0); bb = b.getbbox()
    if not bb or (bb[2]-bb[0])*(bb[3]-bb[1]) < 0.02*w*h: continue
    tops = [x for x in range(w) if b.getpixel((x, bb[1] + 2))]
    if not tops: continue
    c = tops[len(tops)//2]; row = min(h-1, int(bb[1] + 0.06*h))
    if not b.getpixel((c, row)): continue
    l = c; r = c
    while l > 0 and b.getpixel((l-1, row)): l -= 1
    while r < w-1 and b.getpixel((r+1, row)): r += 1
    T.append(bb[1]/h); B.append(bb[3]/h); CX.append((l+r)/2/w); HW.append((r-l)/w)
med = lambda a: sorted(a)[len(a)//2] if a else None
print(json.dumps({"top": med(T), "bottom": med(B), "cx": med(CX), "head": med(HW), "samples": len(T)}))`, D(dir, 'matte')]));
    writeJson(cache, box);
  }
  const T = p.presenterTop ?? STYLE.defaults.presenterTop;
  if (box.top == null) return { s: p.presenterScale ?? 0.6, cx: 0.5, t: 0.15, T };
  // head about 21% of the frame width (the references), never so small that the body ends above the frame edge
  let s = (p.presenterHead ?? STYLE.defaults.presenterHead) / Math.max(0.05, box.head);
  s = Math.max(s, (1 - T) / Math.max(0.15, box.bottom - box.top));
  s = Math.min(s, 2.4);
  if (p.presenterScale) s = p.presenterScale;
  return { s: +s.toFixed(3), cx: +box.cx.toFixed(3), t: +box.top.toFixed(3), T };
}
function blender(dir, args, extra, s) {
  s ||= sceneJson(dir, { preview: args.includes('--preview') });
  const sj = D(dir, 'scene.json'); writeJson(sj, s);
  return new Promise((resolve, reject) => {
    const ch = spawn(BLENDER, ['-b', '--factory-startup', '-noaudio', '-P', path.join(HERE, 'scene.py'), '--', sj, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let outp = '';
    ch.stdout.on('data', (d) => { outp += d; }); ch.stderr.on('data', (d) => { outp += d; });
    ch.on('close', (code) => {
      const tag = (extra.includes('--pass') ? extra[extra.indexOf('--pass') + 1] : 'all') + (extra.includes('--start') ? `-${extra[extra.indexOf('--start') + 1]}` : '');
      fs.writeFileSync(D(dir, `blender-${tag}.log`), outp);
      for (const l of outp.split('\n')) if (/^(depth:|Traceback)/.test(l) || /Error:/.test(l)) console.log(l);
      code ? reject(new Error(`blender ${tag} failed (see edit/depth/blender-${tag}.log)`)) : resolve(s);
    });
  });
}
const PASSES = ['world', 'presenter', 'front', 'text'];
// world first (the heavy one), the three light passes in parallel with it
async function renderPasses(dir, args, out, extra) {
  const s = sceneJson(dir, { preview: args.includes('--preview') });
  const only = opt(args, '--passes', null)?.split(',');
  // the world pass (the heavy one) is split into chunks rendered in parallel: Eevee on Apple silicon leaves the GPU
  // a third idle with one process (measured on an M3: 12 -> 25 frames a minute with 3 chunks)
  const chunks = Number(opt(args, '--chunks', 3));
  if (chunks > 1 && !extra.includes('--stills') && (!only || only.includes('world'))) {
    const a = extra.includes('--start') ? Number(extra[extra.indexOf('--start') + 1]) : 1;
    const z = extra.includes('--end') ? Number(extra[extra.indexOf('--end') + 1]) : s.frames;
    const rest = extra.filter((x, i) => !['--start', '--end'].includes(x) && !['--start', '--end'].includes(extra[i - 1]));
    const n = Math.max(1, Math.min(chunks, Math.ceil((z - a + 1) / 60))); const step = Math.ceil((z - a + 1) / n);
    fs.mkdirSync(path.join(out, 'world'), { recursive: true });
    const jobs = Array.from({ length: n }, (_, k) => blender(dir, args, ['--pass', 'world', '--out', path.join(out, 'world'), '--start', String(a + k * step), '--end', String(Math.min(z, a + (k + 1) * step - 1)), ...rest], s));
    jobs.push(...PASSES.filter((ps) => ps !== 'world' && (!only || only.includes(ps))).map((ps) => { fs.mkdirSync(path.join(out, ps), { recursive: true }); return blender(dir, args, ['--pass', ps, '--out', path.join(out, ps), ...extra], s); }));
    await Promise.all(jobs);
    return s;
  }
  await Promise.all(PASSES.filter((ps) => !only || only.includes(ps)).map((ps) => { fs.mkdirSync(path.join(out, ps), { recursive: true }); return blender(dir, args, ['--pass', ps, '--out', path.join(out, ps), ...extra], s); }));
  return s;
}
// stack the four passes for one frame (PIL), for stills
function stack(out, f, dst) {
  sh('python3', ['-c', `
import sys, os
from PIL import Image
d, f, dst = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(os.path.join(d, 'world', f)).convert('RGBA')
for p in ('presenter', 'front', 'text'):
    q = os.path.join(d, p, f)
    if os.path.exists(q): im.alpha_composite(Image.open(q).convert('RGBA').resize(im.size))
im.convert('RGB').save(dst)`, out, f, dst]);
}
async function stills(dir, args) {
  const s = sceneJson(dir, { preview: args.includes('--preview') });
  const at = opt(args, '--at', null);
  const fs_ = at ? at.split(',').map((t) => Math.round(Number(t) * FPS) + 1) : s.beats.map((b) => Math.round((b.f0 + b.f1) / 2 + Math.min(12, (b.f1 - b.f0) / 4)));
  const out = D(dir, 'stills'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  await renderPasses(dir, args, out, ['--stills', fs_.join(',')]);
  const files = fs_.map((f) => { const n = `${String(f).padStart(5, '0')}.png`; const dst = path.join(out, n); stack(out, n, dst); return dst; });
  const cols = Math.min(6, files.length);
  if (files.length === 1) sh('ffmpeg', ['-y', '-v', 'error', '-i', files[0], '-vf', 'scale=270:480', '-frames:v', '1', '-q:v', '3', path.join(out, 'sheet.jpg')]);
  else sh('ffmpeg', ['-y', '-v', 'error', ...files.flatMap((f) => ['-i', f]), '-filter_complex', `${files.map((_, k) => `[${k}]scale=270:480[s${k}]`).join(';')};${files.map((_, k) => `[s${k}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, k) => `${(k % cols) * 276}_${Math.floor(k / cols) * 486}`).join('|')}:fill=black`, '-frames:v', '1', '-q:v', '3', path.join(out, 'sheet.jpg')]);
  console.log(path.join(out, 'sheet.jpg'));
}
async function render(dir, args) {
  const out = D(dir, args.includes('--preview') ? 'frames-preview' : 'frames');
  const from = opt(args, '--from', null), to = opt(args, '--to', null);
  if (!from && !to) fs.rmSync(out, { recursive: true, force: true });
  const extra = [];
  if (from) extra.push('--start', String(Math.round(Number(from) * FPS) + 1));
  if (to) extra.push('--end', String(Math.round(Number(to) * FPS)));
  const t0 = Date.now();
  const s = await renderPasses(dir, args, out, extra);
  log(`render ${path.basename(dir)}${args.includes('--preview') ? ' (preview)' : ''}: ${s.frames} frames x ${PASSES.length} passes in ${Math.round((Date.now() - t0) / 1000)}s`);
}
// ---------- sound: SFX on every event + a music bed, from ~/content-os/sound/index.json ----------
// each sound is aligned so its peak (peak_at) lands on the event frame
const SOUND = path.join(os.homedir(), 'content-os', 'sound');
function sfxPlan(dir, s, p) {
  const bank = readJson(path.join(SOUND, 'index.json'), []);
  if (!bank.length) return { events: [], music: null };
  const by = {}; for (const x of bank) (by[x.category] ||= []).push(x);
  let seed = [...(p.seed || path.basename(dir))].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const last = {};
  const pick = (cat) => { const l = by[cat]; if (!l?.length) return null; let x; for (let i = 0; i < 4; i++) { x = l[Math.floor(rnd() * l.length)]; if (x.id !== last[cat]) break; } last[cat] = x.id; return x; };
  const ev = []; const sec = (f) => (f - 1) / FPS;
  const add = (cat, t, gain, why) => { const x = pick(cat); if (!x) return; const st = t - (x.peak_at || 0); if (st < 0 && t > 0.05) return; ev.push({ t: +Math.max(0, st).toFixed(3), at: +t.toFixed(3), name: x.id, cat, file: path.join(SOUND, x.file), dur: x.dur, gain, why }); };
  s.beats.forEach((b, i) => {
    const t = sec(b.f0);
    if (i > 0) {
      const tr = b.transition;
      if (tr.startsWith('whip')) add('whoosh', t, 0.75, `${b.id} ${tr}`);
      else if (tr === 'push') add(i % 2 ? 'impact' : 'swish', t, i % 2 ? 0.45 : 0.5, `${b.id} push`);
      else if (tr === 'dive') { add('riser', t, 0.55, `${b.id} dive`); add('impact', t + 0.05, 0.5, `${b.id} dive`); }
      else if (tr === 'flash') { add('flash', t, 0.6, `${b.id} flash`); add('subdrop', t, 0.45, `${b.id} flash`); }
      else if (tr === 'dip') add('subdrop', t, 0.5, `${b.id} dip`);
      else if (tr === 'line') add('signature', t, 0.55, `${b.id} line`);
    }
    for (const l of b.layers) {
      if (l.role === 'bg' || l.anim === 'none') continue;
      const lt = sec(l.at) + 0.08;
      if (l.role === 'hero') add(l.anim === 'drop' ? 'impact' : 'pop', lt, l.anim === 'drop' ? 0.35 : 0.45, `${b.id} ${l.id}`);
      else if (l.role === 'card') add(l.anim === 'flip' ? 'paper' : 'pop', lt, 0.45, `${b.id} ${l.id}`);
      else if (l.role === 'fg' && b.transition !== 'cut') add('swish', lt, 0.25, `${b.id} ${l.id}`);
    }
    (b.title?.states || []).forEach((st, k) => add('text', sec(st.f), 0.2, `${b.id} title ${k + 1}`));
  });
  const end = s.frames / FPS;
  const sig = (by.signature || []).slice().sort((a, c) => c.dur - a.dur)[0];
  if (sig) ev.push({ t: +Math.max(0, end - sig.dur + 0.2).toFixed(3), at: end, name: sig.id, cat: 'signature', file: path.join(SOUND, sig.file), dur: sig.dur, gain: 0.6, why: 'ending' });
  const tracks = by.music || [];
  const mu = p.music === false ? null : tracks.find((x) => x.id === p.music) || (tracks.length ? tracks[Math.floor(rnd() * tracks.length)] : null);
  return { events: ev.sort((a, c) => a.t - c.t), music: mu ? { name: mu.id, file: path.join(SOUND, mu.file), gain: p.musicGain ?? 0.22 } : null };
}
function audioGraph(dir, s, p, firstInput) {
  const plan = sfxPlan(dir, s, p);
  writeJson(D(dir, 'sfx.json'), plan.events.map(({ t, name, dur, cat, why }) => ({ t, name, d: dur, cat, why })));
  const ins = [], parts = [], labels = [];
  let k = firstInput;
  const voice = `[${firstInput - 1}:a]`; // src.mp4 audio
  parts.push(`${voice}aresample=48000,asplit=2[vo][sc]`);
  if (plan.music) {
    ins.push('-stream_loop', '-1', '-i', plan.music.file);
    parts.push(`[${k}:a]aresample=48000,volume=${plan.music.gain},afade=t=in:d=0.6,afade=t=out:st=${(s.frames / FPS - 1.5).toFixed(2)}:d=1.5[mraw];[mraw][sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[mus]`);
    labels.push('[mus]'); k++;
  } else parts.push('[sc]anullsink');
  plan.events.forEach((e, i) => {
    ins.push('-i', e.file);
    const ms = Math.round(e.t * 1000);
    parts.push(`[${k}:a]aresample=48000,volume=${e.gain},adelay=${ms}|${ms}[x${i}]`); labels.push(`[x${i}]`); k++;
  });
  parts.push(`[vo]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.95,atrim=0:${(s.frames / FPS).toFixed(3)}[aout]`);
  return { ins, filter: parts.join(';'), n: plan.events.length, music: plan.music?.name };
}
function finish(dir, args) {
  const preview = args.includes('--preview');
  const frames = D(dir, preview ? 'frames-preview' : 'frames');
  if (!fs.existsSync(path.join(frames, 'world', '00001.png'))) die('no rendered frames (run render)');
  const n = fs.readdirSync(D(dir)).filter((f) => /^depth-v\d+\.mp4$/.test(f)).length + 1;
  const out = D(dir, preview ? 'depth-preview.mp4' : `depth-v${n}.mp4`);
  const ins = PASSES.flatMap((ps) => ['-framerate', String(FPS), '-i', path.join(frames, ps, '%05d.png')]);
  // world, then the speaker, then the foreground that passes in front of him, then text; graded per the brand
  const LK = STYLE.looks?.[validate(dir).p.look];
  const grade = LK?.grade || `curves=r='0/0.02 0.5/0.49 1/0.96':g='0/0.035 0.5/0.5 1/0.96':b='0/0.045 0.5/0.51 1/0.95',vignette=angle=0.42,noise=alls=5:allf=t`;
  const fc = `[0]scale=${W}:${H}:flags=lanczos,format=rgba[w];[1]scale=${W}:${H},format=rgba[p];[2]scale=${W}:${H},format=rgba[f];[3]scale=${W}:${H}:flags=lanczos,format=rgba[t];[w][p]overlay=format=auto[a];[a][f]overlay=format=auto[b];[b]${grade}[g];[g][t]overlay=format=auto,format=yuv420p[v]`;
  const sc = readJson(D(dir, 'scene.json')); const pl = validate(dir).p;
  const au = sc && !args.includes('--no-sfx') ? audioGraph(dir, sc, pl, 5) : null;
  if (au) log(`sound: ${au.n} sfx${au.music ? `, music ${au.music}` : ''} (edit/depth/sfx.json)`);
  sh('ffmpeg', ['-y', '-v', 'error', ...ins, '-i', D(dir, 'src.mp4'), ...(au ? au.ins : []), '-filter_complex', au ? `${fc};${au.filter}` : fc, '-map', '[v]', '-map', au ? '[aout]' : '4:a?', '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', preview ? '21' : '15', '-maxrate', '16M', '-bufsize', '32M', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
  log(`finish ${path.basename(dir)}: ${path.relative(dir, out)}`);
  console.log(out);
}
// open the assembled scene in Blender, with the timeline, to look at it by hand
async function openBlend(dir, args) {
  const s = sceneJson(dir, { preview: true });
  const blend = D(dir, 'scene.blend');
  const f = Number(opt(args, '--frame', s.beats[0] ? Math.round((s.beats[0].f0 + s.beats[0].f1) / 2) : 1));
  await blender(dir, args, ['--save', blend, '--frame', String(f), '--no-render'], s);
  spawn('open', ['-na', 'Blender', '--args', blend, '--python', path.join(HERE, 'viewer.py')], { detached: true, stdio: 'ignore' }).unref();
  console.log(blend);
}
// transcribe src.mp4 itself (word times on the edited timeline): ElevenLabs Scribe, else Gemini
async function words(dir) {
  const env = Object.fromEntries((fs.existsSync(path.join(os.homedir(), '.env.local')) ? fs.readFileSync(path.join(os.homedir(), '.env.local'), 'utf8') : '').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
  const audio = D(dir, 'src-audio.mp3');
  sh('ffmpeg', ['-y', '-v', 'error', '-i', D(dir, 'src.mp4'), '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio]);
  let ws = null, used = '';
  if (env.ELEVENLABS_API_KEY) {
    const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'heb'); fd.append('timestamps_granularity', 'word');
    fd.append('file', new Blob([fs.readFileSync(audio)], { type: 'audio/mpeg' }), 'a.mp3');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }, body: fd });
    if (r.ok) { ws = ((await r.json()).words || []).filter((w) => w.type !== 'spacing').map((w) => ({ t: w.text, s: +w.start.toFixed(3), e: +w.end.toFixed(3) })); used = 'elevenlabs'; }
  }
  if (!ws && env.GEMINI_API_KEY) {
    const cfg = readJson(P('config.json'), {});
    const body = { contents: [{ parts: [{ text: 'Transcribe this Hebrew audio verbatim. Return JSON only: an array of {"t": word with its punctuation, "s": start seconds, "e": end seconds}, one per spoken word, in order, times with 2 decimals. Be precise about times.' }, { inlineData: { mimeType: 'audio/mpeg', data: fs.readFileSync(audio).toString('base64') } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel || 'gemini-flash-latest'}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const j = await r.json(); ws = JSON.parse(j.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '[]').filter((w) => w.t && w.e >= w.s).map((w) => ({ t: String(w.t), s: +Number(w.s).toFixed(3), e: +Number(w.e).toFixed(3) })); used = 'gemini'; }
  }
  if (!ws) die('transcription failed (no ElevenLabs credit and no Gemini)');
  writeJson(D(dir, 'words.json'), ws);
  const lines = []; let cur = [];
  ws.forEach((w, i) => { cur.push(w); const n = ws[i + 1]; if (!n || /[.?!…,]$/.test(w.t) || n.s - w.e > 0.45) { lines.push(`${cur[0].s.toFixed(2)}-${cur.at(-1).e.toFixed(2)}  ${cur.map((x) => x.t).join(' ')}`); cur = []; } });
  fs.writeFileSync(D(dir, 'transcript.txt'), lines.join('\n') + '\n');
  log(`words ${path.basename(dir)}: ${ws.length} words (${used})`);
}

// plan by itself: Claude (headless) writes plan.json with the systm-depth-plan skill, in a look not used recently
const PLUGIN = path.join(os.homedir(), '.claude/local-marketplaces/content-os-marketplace/plugins/systm-depth');
function pickLook(dir) {
  const looks = Object.keys(STYLE.looks || {}); if (!looks.length) return null;
  const used = [];
  for (const id of fs.readdirSync(P('projects'))) {
    const f = path.join(P('projects'), id, 'edit', 'depth', 'plan.json'); if (path.join(P('projects'), id) === dir || !fs.existsSync(f)) continue;
    const pl = readJson(f, {}); if (pl.look) used.push([fs.statSync(f).mtimeMs, pl.look]);
  }
  used.sort((a, b) => b[0] - a[0]); const recent = used.slice(0, looks.length - 1).map((x) => x[1]);
  const free = looks.filter((l) => !recent.includes(l));
  return (free.length ? free : looks)[Math.floor(Math.random() * (free.length || looks.length))];
}
async function autoplan(dir, args) {
  const look = opt(args, '--look', null) || readJson(D(dir, 'plan.json'), {}).look || pickLook(dir);
  if (!fs.existsSync(D(dir, 'transcript.txt'))) die('no transcript (run words first)');
  const prompt = [
    `Plan a SYSTM Depth edit, end to end, with no questions. Project: ${dir}.`,
    `Follow the skill ${PLUGIN}/skills/systm-depth-plan/SKILL.md exactly, with ${PLUGIN}/references/depth.md (the plan.json contract), ${PLUGIN}/references/motion-grammar.md and ${P('research/depth-refs/bgstudy/findings.md')}.`,
    `Inputs: ${D(dir, 'transcript.txt')} and ${D(dir, 'words.json')} (word times). Look for this video: "${look}" (from ${path.join(HERE, 'style.json')}).`,
    `Write ${D(dir, 'plan.json')} (keep "duration" as it is, set "look": "${look}"), then run: node ${path.join(HERE, 'depth.mjs')} check ${dir}  — and fix until it prints "plan ok".`,
    'Also write a short notes.md next to the plan (acts, actor, the beat table). Do not paint, render or publish anything.',
  ].join('\n');
  log(`autoplan ${path.basename(dir)}: look ${look}`);
  await new Promise((resolve, reject) => {
    const ch = spawn('claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(python3:*)', '--add-dir', PLUGIN], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; ch.stdout.on('data', (d) => { o += d; }); ch.stderr.on('data', (d) => { o += d; });
    ch.on('close', (c) => { fs.writeFileSync(D(dir, 'autoplan.log'), o); c ? reject(new Error('autoplan failed (edit/depth/autoplan.log)')) : resolve(); });
  });
  const { errs } = validate(dir); if (errs.length) die(`autoplan left errors:\n${errs.join('\n')}`);
  log(`autoplan ${path.basename(dir)}: plan ok`);
}

const cmds = {
  init: (d, a) => init(d, a), words: (d) => words(d), autoplan: (d, a) => autoplan(d, a), matte: (d, a) => matte(d, a), check: (d) => check(d), layers: (d, a) => layers(d, a), text: (d) => text(d),
  stills: (d, a) => stills(d, a), render: (d, a) => render(d, a), finish: (d, a) => finish(d, a), open: (d, a) => openBlend(d, a),
  async run(d, a) { await layers(d, a); await text(d); await render(d, a); finish(d, a); },
};
const [cmd, name, ...rest] = process.argv.slice(2);
if (!cmds[cmd]) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }
Promise.resolve(cmds[cmd](projDir(name), rest)).catch((e) => die(e.stack || e.message));
