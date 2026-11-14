#!/usr/bin/env node
// Content OS engine: deterministic steps the agents (Claude / Codex) call.
// No dependencies. Usage: node engine/cos.mjs <command> [args]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const MEDIA = /\.(mp4|mov|m4v|mkv|webm|wav|m4a|mp3)$/i;
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const sh = (cmd, args, opt = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...opt });
const config = () => ({ agent: 'claude', publishMode: 'approve', stableSeconds: 15, ...readJson(P('config.json'), {}), ...(process.env.COS_AGENT ? { agent: process.env.COS_AGENT } : {}) });
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.mkdirSync(P('logs'), { recursive: true }); fs.appendFileSync(P('logs', 'engine.log'), l + '\n'); };
const die = (m) => { console.error('cos: ' + m); process.exit(1); };

function projDir(name) {
  if (!name) die('missing project name');
  const d = fs.existsSync(name) && fs.statSync(name).isDirectory() ? path.resolve(name) : P('projects', name);
  if (!fs.existsSync(d)) die(`project not found: ${name}`);
  return d;
}
function setStage(dir, stage, extra = {}) {
  const f = path.join(dir, 'status.json');
  const s = readJson(f, { history: [] });
  s.stage = stage; s.updatedAt = new Date().toISOString(); Object.assign(s, extra);
  s.history.push({ stage, at: s.updatedAt });
  writeJson(f, s);
}
// Push the latest state to SYSTM Studio (no-op when the cloud side is not set up).
function syncPush() {
  if (!fs.existsSync(P('cloud', '.env.local'))) return;
  spawnSync(process.execPath, [P('cloud', 'sync.mjs'), 'push'], { cwd: ROOT, stdio: 'ignore', timeout: 20 * 60e3 });
}
function loadEnv() {
  const f = path.join(os.homedir(), '.env.local');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
function probe(file) {
  const j = JSON.parse(sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const [n, d] = (v?.avg_frame_rate || '0/1').split('/').map(Number);
  const rot = Math.abs(Number(v?.side_data_list?.find((x) => x.rotation !== undefined)?.rotation || 0));
  const sw = rot === 90 || rot === 270;
  return {
    file: path.basename(file), duration: Number(j.format.duration), sizeMB: +(Number(j.format.size) / 1e6).toFixed(1),
    video: v ? { codec: v.codec_name, width: sw ? v.height : v.width, height: sw ? v.width : v.height, fps: d ? +(n / d).toFixed(3) : 0, rotation: rot } : null,
    audio: a ? { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels } : null,
  };
}
const slugify = (s) => s.normalize('NFKD').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'clip';
const mainRaw = (dir) => { const m = readJson(path.join(dir, 'meta.json')); if (!m) die('no meta.json'); return path.join(dir, 'raw', m.clips[0].file); };

const cmds = {
  // new <file...> [--name slug]  : create a project from one or more raw files (moved into raw/)
  new(args) {
    const ni = args.indexOf('--name');
    const name = ni >= 0 ? args.splice(ni, 2)[1] : null;
    const keep = args.includes('--copy'); args = args.filter((a) => a !== '--copy');
    if (!args.length) die('usage: new <file...> [--name slug] [--copy]');
    const day = new Date().toLocaleDateString('sv-SE');
    let id = `${day}-${slugify(name || path.basename(args[0]))}`, i = 2;
    while (fs.existsSync(P('projects', id))) id = `${day}-${slugify(name || path.basename(args[0]))}-${i++}`;
    const dir = P('projects', id);
    for (const sub of ['raw', 'work', 'edit', 'out', 'cover', 'copy', 'guide', 'review', 'publish']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    const clips = [];
    for (const src of args) {
      const dst = path.join(dir, 'raw', path.basename(src));
      if (keep) fs.copyFileSync(src, dst); else { try { fs.renameSync(src, dst); } catch { fs.copyFileSync(src, dst); fs.unlinkSync(src); } }
      clips.push(probe(dst));
    }
    if (clips.length > 1) {
      // several clips of one video: join them (in name order) into one working file so the rest of the engine sees a single timeline
      const c0 = clips[0].video, fps = Math.round(c0.fps) >= 50 ? 30 : Math.round(c0.fps) || 30;
      const ins = clips.flatMap((c) => ['-i', path.join(dir, 'raw', c.file)]);
      const f = clips.map((_, i) => `[${i}:v]scale=${c0.width}:${c0.height}:force_original_aspect_ratio=decrease,pad=${c0.width}:${c0.height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1,format=yuv420p[v${i}];[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`).join(';') + ';' + clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${clips.length}:v=1:a=1[v][a]`;
      sh('ffmpeg', ['-y', '-v', 'error', ...ins, '-filter_complex', f, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-c:a', 'aac', '-b:a', '256k', path.join(dir, 'raw', '_merged.mp4')]);
      let off = 0; const sources = clips.map((c) => { const s = { file: c.file, start: +off.toFixed(3), duration: c.duration }; off += c.duration; return s; });
      clips.unshift({ ...probe(path.join(dir, 'raw', '_merged.mp4')), sources });
    }
    writeJson(path.join(dir, 'meta.json'), { id, createdAt: new Date().toISOString(), clips });
    setStage(dir, 'ingested');
    log(`new project ${id} (${clips.length} clip, ${clips[0].duration.toFixed(1)}s)`);
    console.log(id);
    return id;
  },

  probe([file]) { console.log(JSON.stringify(probe(file), null, 2)); },

  // transcribe <project> [--lang heb] : ElevenLabs Scribe with word timestamps
  async transcribe([name, ...rest]) {
    const dir = projDir(name); loadEnv();
    const key = process.env.ELEVENLABS_API_KEY;
    const lang = rest[rest.indexOf('--lang') + 1] && rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'heb';
    const audio = path.join(dir, 'work', 'audio.mp3');
    sh('ffmpeg', ['-y', '-v', 'error', '-i', mainRaw(dir), '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio]);
    const engine = rest.includes('--engine') ? rest[rest.indexOf('--engine') + 1] : 'auto';
    let words = null, used = null, language = lang, approx = false, err = '';
    if (engine !== 'gemini' && key) {
      const fd = new FormData();
      fd.append('model_id', 'scribe_v1'); fd.append('language_code', lang);
      fd.append('timestamps_granularity', 'word'); fd.append('diarize', 'false'); fd.append('tag_audio_events', 'false');
      fd.append('file', new Blob([fs.readFileSync(audio)], { type: 'audio/mpeg' }), 'audio.mp3');
      const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
      if (r.ok) { const j = await r.json(); used = 'elevenlabs-scribe'; language = j.language_code; words = (j.words || []).filter((w) => w.type !== 'spacing').map((w) => ({ t: w.text, s: +w.start.toFixed(3), e: +w.end.toFixed(3) })); }
      else { err = `ElevenLabs ${r.status} ${(await r.text()).slice(0, 200)}`; log(`transcribe: ${err}`); }
    }
    if (!words && engine !== 'elevenlabs') {
      // Fallback: Gemini. Word times are model estimates, so captions built from them need a visual check.
      const gk = process.env.GEMINI_API_KEY; if (!gk) die(`${err || 'no ElevenLabs'}; GEMINI_API_KEY missing too`);
      const model = config().geminiModel || 'gemini-flash-latest';
      const body = { contents: [{ parts: [
        { text: `Transcribe this ${lang === 'heb' ? 'Hebrew' : lang} audio verbatim, including repeated takes and filler words. Return JSON only: an array of objects {"t": word with its punctuation, "s": start seconds, "e": end seconds}, one object per spoken word, times as decimals with 2 digits, in order.` },
        { inlineData: { mimeType: 'audio/mpeg', data: fs.readFileSync(audio).toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 } };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': gk, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const t = (await r.text()).slice(0, 300); setStage(dir, 'transcribe_failed', { error: `${err}; Gemini ${r.status} ${t}` }); die(`transcription failed. ${err}; Gemini ${r.status} ${t}`); }
      const j = await r.json(); const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '[]';
      words = JSON.parse(txt).filter((w) => w.t && w.e >= w.s).map((w) => ({ t: String(w.t), s: +Number(w.s).toFixed(3), e: +Number(w.e).toFixed(3) }));
      used = `gemini:${model}`; approx = true;
    }
    if (!words) { setStage(dir, 'transcribe_failed', { error: err }); die(`transcription failed. ${err}`); }
    const j = { language_code: language, text: words.map((w) => w.t).join(' ') };
    // sentences: split on punctuation or a pause longer than 0.6s
    const sents = []; let cur = [];
    words.forEach((w, i) => {
      cur.push(w); const next = words[i + 1];
      if (!next || /[.?!…]$/.test(w.t) || next.s - w.e > 0.6) { sents.push({ i: sents.length, s: cur[0].s, e: cur.at(-1).e, text: cur.map((x) => x.t).join(' ') }); cur = []; }
    });
    writeJson(path.join(dir, 'work', 'transcript.json'), { engine: used, approxTimes: approx, language: j.language_code, text: j.text, words, sentences: sents });
    fs.writeFileSync(path.join(dir, 'work', 'transcript.md'), sents.map((s) => `[${s.i}] ${s.s.toFixed(2)}-${s.e.toFixed(2)}  ${s.text}`).join('\n') + '\n');
    setStage(dir, 'transcribed');
    log(`transcribed ${path.basename(dir)} with ${used}${approx ? ' (approximate word times)' : ''}: ${words.length} words, ${sents.length} sentences`);
  },

  // silences <project> [--db -32] [--min 0.45]
  silences([name, ...rest]) {
    const dir = projDir(name);
    const opt = (k, d) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : d);
    const out = spawnSync('ffmpeg', ['-v', 'info', '-i', mainRaw(dir), '-af', `silencedetect=noise=${opt('--db', '-32')}dB:d=${opt('--min', '0.45')}`, '-vn', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || '';
    const st = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
    const en = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
    const sil = st.map((s, i) => ({ s, e: en[i] ?? null, d: en[i] ? +(en[i] - s).toFixed(2) : null }));
    writeJson(path.join(dir, 'work', 'silences.json'), sil);
    console.log(`${sil.length} silences, total ${sil.reduce((a, x) => a + (x.d || 0), 0).toFixed(1)}s`);
  },

  // cut <project> : render edit/cuts.json -> edit/rough.mp4
  // cuts.json: { "segments": [ { "s": 1.20, "e": 4.85, "note": "hook" }, ... ], "crop": "9:16" | null }
  cut([name]) {
    const dir = projDir(name);
    const plan = readJson(path.join(dir, 'edit', 'cuts.json')); if (!plan?.segments?.length) die('edit/cuts.json with segments[] is required');
    const meta = readJson(path.join(dir, 'meta.json')).clips[0];
    const fps = Math.round(meta.video.fps) >= 50 ? 30 : Math.round(meta.video.fps) || 30;
    const parts = [], labels = [];
    plan.segments.forEach((g, i) => {
      if (!(g.e > g.s)) die(`segment ${i} has e <= s`);
      parts.push(`[0:v]trim=${g.s}:${g.e},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${g.s}:${g.e},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${(g.e - g.s - 0.012).toFixed(3)}:d=0.012[a${i}]`);
      labels.push(`[v${i}][a${i}]`);
    });
    let post = 'null';
    if (plan.crop === '9:16' && meta.video.width > meta.video.height) post = 'crop=ih*9/16:ih';
    const tall = plan.crop === '9:16' || meta.video.height > meta.video.width;
    post += tall ? ',scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920' : ',scale=1920:-2';
    const filter = `${parts.join(';')};${labels.join('')}concat=n=${plan.segments.length}:v=1:a=1[vc][ac];[vc]${post},fps=${fps},format=yuv420p[v];[ac]loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
    const out = path.join(dir, 'edit', 'rough.mp4');
    sh('ffmpeg', ['-y', '-v', 'error', '-i', mainRaw(dir), '-filter_complex', filter, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);
    // remap word timings to the new timeline, for captions
    const tr = readJson(path.join(dir, 'work', 'transcript.json'));
    if (tr) {
      let off = 0; const words = [];
      for (const g of plan.segments) { for (const w of tr.words) if (w.s >= g.s - 0.02 && w.e <= g.e + 0.02) words.push({ t: w.t, s: +(w.s - g.s + off).toFixed(3), e: +(w.e - g.s + off).toFixed(3) }); off += g.e - g.s; }
      writeJson(path.join(dir, 'edit', 'words.json'), words);
    }
    const p = probe(out); setStage(dir, 'rough_cut', { roughDuration: p.duration });
    console.log(`rough.mp4 ${p.duration.toFixed(2)}s ${p.video.width}x${p.video.height}@${p.video.fps} (from ${meta.duration.toFixed(1)}s raw)`);
  },

  // sheet <video> [--n 12] [--out file.jpg] : contact sheet so the agent can look at the cut
  sheet([file, ...rest]) {
    if (!file) die('usage: sheet <video> [--n 12] [--out file.jpg]');
    const n = Number(rest.includes('--n') ? rest[rest.indexOf('--n') + 1] : 12);
    const out = rest.includes('--out') ? rest[rest.indexOf('--out') + 1] : file.replace(/\.[^.]+$/, '') + '.sheet.jpg';
    const p = probe(file); const cols = p.video.height > p.video.width ? 6 : 4;
    sh('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', `fps=${(n / p.duration).toFixed(5)},scale=${p.video.height > p.video.width ? 270 : 480}:-2,tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=black`, '-frames:v', '1', '-q:v', '3', out]);
    console.log(out);
  },

  // frame <video> <seconds> [out.jpg]
  frame([file, t, out]) {
    out ||= file.replace(/\.[^.]+$/, '') + `.f${String(t).replace('.', '_')}.jpg`;
    sh('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-q:v', '2', out]); console.log(out);
  },

  // version <project> <video> : register a rendered file as the next review version (out/vN.mp4)
  version([name, file]) {
    const dir = projDir(name); if (!file || !fs.existsSync(file)) die('usage: version <project> <video>');
    const n = fs.readdirSync(path.join(dir, 'out')).filter((f) => /^v\d+\.mp4$/.test(f)).length + 1;
    const dst = path.join(dir, 'out', `v${n}.mp4`); fs.copyFileSync(file, dst);
    setStage(dir, 'in_review', { version: n }); console.log(dst);
  },

  // review <project> [--port 4455] : frame-accurate notes room in the browser
  review([name, ...rest]) {
    const dir = projDir(name); const port = rest.includes('--port') ? rest[rest.indexOf('--port') + 1] : '4455';
    const child = spawn(process.execPath, [P('engine', 'review-server.mjs'), dir, port], { stdio: 'inherit' });
    child.on('exit', (c) => process.exit(c ?? 0));
  },

  // stage <project> <stage> : set the stage by hand (used by the agents, e.g. packaged = ready to publish from the Studio)
  stage([name, stage]) {
    const dir = projDir(name); if (!stage || !/^[a-z_]+$/.test(stage)) die('usage: stage <project> <stage>');
    setStage(dir, stage); syncPush(); console.log(`${path.basename(dir)}: ${stage}`);
  },

  status() {
    const dirs = fs.existsSync(P('projects')) ? fs.readdirSync(P('projects')).filter((d) => fs.existsSync(P('projects', d, 'status.json'))).sort() : [];
    if (!dirs.length) return console.log('no projects yet. drop a video into inbox/');
    for (const d of dirs) { const s = readJson(P('projects', d, 'status.json')); console.log(`${d.padEnd(46)} ${String(s.stage).padEnd(18)} ${s.version ? 'v' + s.version : ''} ${s.updatedAt?.slice(0, 16) || ''}`); }
  },

  // watch : called by launchd when inbox/ changes. Picks up finished files and hands each to the agent.
  async watch() {
    const cfg = config(); const lock = P('logs', 'watch.lock');
    fs.mkdirSync(P('logs'), { recursive: true }); fs.mkdirSync(P('inbox'), { recursive: true });
    if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 3 * 3600e3) return log('watch: another run is active, skipping');
    fs.writeFileSync(lock, String(process.pid));
    try {
      // an item is a media file, or a folder of clips that belong to one video
      const clipsOf = (d) => fs.readdirSync(d).filter((f) => MEDIA.test(f) && !f.startsWith('.')).sort().map((f) => path.join(d, f));
      const items = () => fs.readdirSync(P('inbox')).filter((f) => !f.startsWith('.')).map((f) => P('inbox', f))
        .map((f) => (fs.statSync(f).isDirectory() ? { path: f, files: clipsOf(f), dir: true } : { path: f, files: MEDIA.test(f) ? [f] : [] })).filter((x) => x.files.length);
      const size = () => Object.fromEntries(items().map((x) => [x.path, x.files.length + ':' + x.files.reduce((a, f) => a + fs.statSync(f).size, 0)]));
      const runAgent = async (id, prompt) => {
        if (cfg.agent === 'none') return;
        const [bin, args] = cfg.agent === 'codex' ? ['codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', ROOT, prompt]] : ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits']];
        log(`handing ${id} to ${cfg.agent}`);
        const out = fs.openSync(P('logs', `${id}.agent.log`), 'a');
        await new Promise((res) => { const c = spawn(bin, args, { cwd: ROOT, stdio: ['ignore', out, out], env: { ...process.env, PATH: `${os.homedir()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }); c.on('exit', (code) => { log(`${cfg.agent} finished ${id} with code ${code}`); res(); }); c.on('error', (e) => { log(`${cfg.agent} failed to start: ${e.message}`); res(); }); });
        syncPush();
      };
      // 1. new footage
      if (items().length) {
        const a = size(); await new Promise((r) => setTimeout(r, cfg.stableSeconds * 1000)); const b = size();
        const ready = items().filter((x) => a[x.path] === b[x.path]);
        for (const x of ready) {
          const id = cmds.new(x.dir ? [...x.files, '--name', path.basename(x.path)] : x.files);
          if (x.dir) fs.rmSync(x.path, { recursive: true, force: true });
          syncPush();
          await runAgent(id, `סרטון גלם חדש נכנס למערכת התוכן. הפרויקט: projects/${id}. הפעל את הסקיל content-pipeline על הפרויקט הזה מתחילתו ועד שלב הסקירה. מצב פרסום: ${cfg.publishMode}.`);
        }
      }
      // 2. follow-ups from the review room / SYSTM Studio: notes to fix, or an approved version to package and schedule
      const dirs = fs.existsSync(P('projects')) ? fs.readdirSync(P('projects')).filter((d) => fs.existsSync(P('projects', d, 'status.json'))) : [];
      for (const id of dirs) {
        const sf = P('projects', id, 'status.json'); const s = readJson(sf, {});
        if (!['notes_received', 'approved'].includes(s.stage)) continue;
        const mark = `${s.stage}@v${s.version}`; if (s.agentDone === mark) continue;
        writeJson(sf, { ...s, agentDone: mark });
        await runAgent(id, s.stage === 'notes_received'
          ? `אריאל שלח הערות על גרסה v${s.version} של projects/${id} (בקובץ review/notes-v${s.version}.json). הפעל את הסקיל content-edit, תקן לפי כל ההערות, ורשום גרסה חדשה לסקירה.`
          : `אריאל אישר את גרסה v${s.version} של projects/${id}, כולל הכיתובים ונוסח ה-AutoDM שהוצגו לו. הכן את הפרויקט לפרסום מ-SYSTM Studio: קאבר אם חסר (content-cover), אריזה מלאה (content-package), גרסאות Trial Reels ב-out/trial/ עם publish/trial.json (content-trial), ו-publish/autodm.json מלא. אל תפרסם ואל תתזמן בעצמך: אריאל לוחץ "פרסם" או "תזמן" באפליקציה. בסוף: node engine/cos.mjs stage ${id} packaged.`);
      }
    } finally { fs.rmSync(lock, { force: true }); }
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmds[cmd]) { console.log('commands: ' + Object.keys(cmds).join(', ')); process.exit(cmd ? 2 : 0); }
await cmds[cmd](args);
