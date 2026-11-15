#!/usr/bin/env node
// DOPPEL → SYSTM Depth bridge (runs on the Mac).
// DOPPEL (the avatar studio on the VPS, video_engine: depth) queues posts at its edit stage. This pulls each one, edits it
// here in the SYSTM Depth style (Blender, Apple Vision, Codex image_gen, the sound bank), and uploads the finished video
// back, where DOPPEL continues to review and scheduling as usual. Nothing is published from here.
//
//   node engine/depth/doppel-bridge.mjs            one pass over the queue (for launchd / cron)
//   node engine/depth/doppel-bridge.mjs --watch    keep polling every 2 minutes
//   node engine/depth/doppel-bridge.mjs --id 123   one post
// Needs in ~/.env.local: DOPPEL_URL (e.g. https://doppel.example.com) and DEPTH_TOKEN (the same value as on the VPS).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const DEPTH = path.join(HERE, 'depth.mjs');
const env = Object.fromEntries((fs.existsSync(path.join(os.homedir(), '.env.local')) ? fs.readFileSync(path.join(os.homedir(), '.env.local'), 'utf8') : '')
  .split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const BASE = (process.env.DOPPEL_URL || env.DOPPEL_URL || '').replace(/\/$/, '');
const TOKEN = process.env.DEPTH_TOKEN || env.DEPTH_TOKEN || '';
const argv = process.argv.slice(2);
const log = (m) => console.log(`[${new Date().toISOString()}] doppel-bridge: ${m}`);
if (!BASE || !TOKEN) { console.error('DOPPEL_URL and DEPTH_TOKEN are needed in ~/.env.local'); process.exit(2); }

const H = { 'x-depth-token': TOKEN };
async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
}
const run = (args) => new Promise((resolve, reject) => {
  log(`depth ${args.join(' ')}`);
  const ch = spawn(process.execPath, [DEPTH, ...args], { cwd: ROOT, stdio: 'inherit' });
  ch.on('close', (c) => (c ? reject(new Error(`depth ${args[0]} failed (${c})`)) : resolve()));
});

async function one(post) {
  const id = `doppel-post-${post.id}`;
  const dir = path.join(ROOT, 'projects', id);
  const dd = path.join(dir, 'edit', 'depth');
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  await api(`/api/depth/claim?id=${post.id}`, { method: 'POST' });
  log(`post ${post.id}: claimed (${post.title || ''})`);
  try {
    const raw = path.join(dir, 'raw', 'avatar.mp4');
    if (!fs.existsSync(raw)) fs.writeFileSync(raw, Buffer.from(await (await api(`/api/depth/file?id=${post.id}&kind=avatar`)).arrayBuffer()));
    fs.writeFileSync(path.join(dir, 'script.md'), post.script || '');
    if (!fs.existsSync(path.join(dd, 'src.mp4'))) await run(['init', id, '--src', raw]);
    // DOPPEL's words are re-timed from the narration itself: exact, no transcription needed
    if (Array.isArray(post.words) && post.words.length) {
      const ws = post.words.map((w) => ({ t: String(w.w ?? w.t), s: +Number(w.start ?? w.s).toFixed(3), e: +Number(w.end ?? w.e).toFixed(3) }));
      fs.writeFileSync(path.join(dd, 'words.json'), JSON.stringify(ws, null, 1));
      const lines = []; let cur = [];
      ws.forEach((w, i) => { cur.push(w); const n = ws[i + 1]; if (!n || /[.?!…,]$/.test(w.t) || n.s - w.e > 0.45) { lines.push(`${cur[0].s.toFixed(2)}-${cur.at(-1).e.toFixed(2)}  ${cur.map((x) => x.t).join(' ')}`); cur = []; } });
      fs.writeFileSync(path.join(dd, 'transcript.txt'), lines.join('\n') + '\n');
    } else await run(['words', id]);
    const mattes = fs.existsSync(path.join(dd, 'matte')) ? fs.readdirSync(path.join(dd, 'matte')).length : 0;
    const steps = [];
    if (mattes < 10) steps.push(run(['matte', id]));
    const plan = JSON.parse(fs.readFileSync(path.join(dd, 'plan.json'), 'utf8'));
    steps.push((plan.beats?.length ? Promise.resolve() : run(['autoplan', id])).then(() => run(['layers', id, '--jobs', '4'])));
    await Promise.all(steps);   // the matte runs while Claude plans and Codex paints
    await run(['text', id]);
    await run(['render', id]);
    await run(['finish', id]);
    const out = fs.readdirSync(dd).filter((f) => /^depth-v\d+\.mp4$/.test(f)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/))).pop();
    const file = path.join(dd, out);
    await api(`/api/depth/result?id=${post.id}`, { method: 'POST', body: fs.readFileSync(file), headers: { 'content-type': 'video/mp4' } });
    fs.copyFileSync(file, path.join(os.homedir(), 'Downloads', `SYSTM-Depth-${id}.mp4`));
    log(`post ${post.id}: done, uploaded ${out} and copied to Downloads`);
  } catch (e) {
    log(`post ${post.id}: failed: ${e.message}`);
    await api(`/api/depth/fail?id=${post.id}`, { method: 'POST', body: JSON.stringify({ error: e.message }), headers: { 'content-type': 'application/json' } }).catch(() => {});
  }
}

async function pass() {
  const only = argv.includes('--id') ? Number(argv[argv.indexOf('--id') + 1]) : null;
  const q = await (await api('/api/depth/queue')).json();
  const todo = q.filter((p) => (only ? p.id === only : p.status === 'queued'));
  if (!todo.length) return log('queue empty');
  for (const p of todo) await one(p);   // one at a time: the render uses the whole GPU
}

if (argv.includes('--watch')) {
  for (;;) { await pass().catch((e) => log(e.message)); await new Promise((r) => setTimeout(r, 120000)); }
} else await pass();
