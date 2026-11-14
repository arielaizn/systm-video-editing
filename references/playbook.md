# SYSTM video editing: every insight from the build sessions

Source: the main Content OS / SYSTM Depth session (2026-11-14 to 2026-11-15), its compaction summaries, the
frame-by-frame analysis reports of the 7 reference reels, the live engine files
(`~/content-os/engine/cos.mjs`, `engine/depth/{depth.mjs,scene.py,style.json,matte.swift,viewer.py,board.mjs}`),
the plugin skills (`content-os`, `systm-depth`), the brand docs (`brand/video-style.md`, `brand/brand.md`),
memory feedback files, and earlier sessions about captions (DaVinci Resolve plugin), Resolve edits, and image grading.

Privacy: no keys, tokens, passwords, account or profile IDs, emails or client names are included. Keys are
referred to by env var name only. All keys live in `~/.env.local` (chmod 600) and must never be printed,
committed, or written to memory.

---

## 0. TL;DR for a future agent

- The user (Ariel, brand SYSTM) only films. Everything else (cut, captions, graphics, grade, sound, cover,
  packaging) is the agent's job, but **nothing is published or scheduled without his approval**. Stop at a
  review version; he approves in the review room / Studio app; agents stop at stage `packaged`.
- Two editing modes:
  1. **SYSTM Cut**: talking head on Carbon, zoom steps 100/112/125 on cuts, SYSTM Display V2 captions with one
     Ice word, glass cards, Ice line that turns at right angles, dark film grade, soft SFX.
  2. **SYSTM Depth**: no video model. Each beat is a 3D "set" built from AI image layers (Codex `image_gen`)
     placed as planes at different depths in Blender, a camera flies through them (parallax + real DOF +
     motion blur), the presenter is cut out with Apple Vision and sits at the bottom, titles build word by
     word, captions are small and screen-locked. 4 render passes composited in ffmpeg with grade and SFX.
- Font for ALL video, covers, titles and captions: **SYSTM Display V2** (Black for titles, ExtraBold/Bold
  for captions). Heebo is only for the website and documents.
- Colors: Carbon `#080C0E` (background, never pure black), Paper `#F5F7F7` (text, never pure white),
  Ice `#ACF4F8` (the ONLY accent, < 10% of the frame). No purple, no neon, no colorful gradients.
- Grade bar: "a frame from a film, not bright stock". Dense exposure, blacks sit on Carbon, whites stop at
  96%, cool/teal shadows, warm natural skin, desaturate everything except skin and Ice, grain 4-6%, light vignette.
- Messages to Ariel: **Hebrew only** (code, paths, file contents and internal notes may be English).
- No emojis anywhere; use real line icons (Lucide).

---

## 1. Ariel's preferences, corrections and rejections

### 1.1 Standing rules (with his words where they are rules)

- **Only films, the system does the rest.** Original brief: a folder hook; when a video lands in the folder
  the system "edits it, plans it, understands it, cuts the cuts, does everything needed and uploads it".
  The upload part was later gated behind approval (`publishMode: "approve"`).
- **Font.** "הגופן שאנחנו תמיד עורכים בו... System Display V2" (the font we always edit in is SYSTM Display V2).
  Repeated in other sessions: "תדאג... לשנות את הפונט של הכתוביות ל-SYSTM Display" and, for PDFs,
  "תעצב את זה בהתאם עם הפונט של SYSTM Display". If a deliverable shipped in another font he asks for a redo.
- **Blender, not three.js.** "אני מעוניין שתשתמש פה בבלנדר ולא ב-3JS".
- **He wants to see the 3D for real.** "אתה בטוח שהרכבת את כל השכבות האלה בבלנדר...? אם לא... תפתח לי את
  הבלנדר ככה שאני אוכל ממש לראות את זה במו עיניי". Always be able to open the `.blend` in the GUI with the
  timeline and an oblique 3D view (`depth.mjs open`). Later: "תפתח לי את הטיימליין, שאני אוכל לראות מה הכיוון"
  and "תפתח לי את הטיימליינים בדפדפן... כל הסרטונים שבעריכה או שבתהליכי רינדור" (browser board of all timelines).
- **Frame-by-frame study before building.** "תחלץ פריים פריים מהסרטונים... תסתכל על התנועה... ועל איך שהם
  עוברים בין דברים... תנתח את זה לעומק. על בסיס זה תבנה". Deliver the finished test video to `~/Downloads`.
- **Test on HIS footage.** He re-uploaded the same file to insist: "שהניסיון שאתה עושה יהיה על החומר גלם הזה...
  ולא לאיזשהו משהו אחר". (Checksum proved it was identical; say so explicitly.) Also "כמה שיותר מהר".
- **Every video a different style, with uncopyable signature marks.** "שהסרטונים יהיו כל סרטון בסגנון שונה
  אבל כן עם סימני זיהוי יחודיים לנו שאי אפשר להעתיק מאיתנו". → 8 looks + fixed signature (font, Ice, Ice-line
  transition, own sonic signature, hallmark object).
- **Real, very good SFX and music, and a reusable bank.** "תחפש כל מיני סאונד אפקטים... טובים מאוד... ותדאג
  לשלב אותם בעריכה... מקים לעצמי כזה בנק כזה של SFX ומוזיקות... עבור השימוש היומיומי".
- **Render faster, use the GPU.** "תעשה שזה ירנדר את זה במהירות גבוהה יותר. שישתמש קצת ב-gpu אין לי בעייה".
- **Hebrew-only communication.** "מעכשיו כל דבר שאתה כותב... חייב להיות אך ורק בעברית... אלא אם כן זה קוד".
  This includes short status lines between tool calls.
- **Workflow:** "תרנדר את זה מקצה לקצה. אני אתן לך הערות לשיפור ותתקדם על פיהם" → always render a full
  version, then iterate on his notes. Never fix the master; rebuild from sources.
- **Quality bar:** he asks for "רמה פי אלף יותר גבוהה", "HBO Max, IMAX", "הכי גבוהה שיש". Favor ambitious
  quality and verify by looking at renders (contact sheets / stills), not by measurements alone.
- **No emojis; icons only.** (Also: decks were rejected for using emojis.)
- **Cost control on generative video:** Seedance always 30 s, 480p (`duration: 30`, `resolution: "480p"`).
  In a Higgsfield/Katana session he said to animate with a cheaper model at 720p "ותדאג כמה שיותר להזיל בעלויות".

### 1.2 Rejections (what he disliked)

- **Black box / outline on captions:** "תוריד בבקשה את המסגרת השחורה המכוערת ששמת לכתוביות! זה סתם מכוער".
  Fix used: no outline, no box; white/Paper text with a soft shadow. (An outline on the heavy font also drew
  odd inner lines in letters like ב and א.)
- **Flat, generic caption styles:** two rounds of caption styles were rejected as "not good enough". His bar
  (an AutoCaptions-style grid: Gradient shadow, White with shadow, Rainbow, Focused Violet, Vivid Lime,
  Editorial, Aura, Simple): soft bloom/glow around letters, two-color gradients, a font chosen per look
  (bold grotesque, italic serif, script), shown as named cards. Rule: start text looks from glow + gradient +
  look-specific font, judge on dark background next to the reference, show a contact sheet before calling it done.
  (For SYSTM-branded videos the accent is still Ice only; the gradient/glow bar applies to caption-style
  libraries and title work in general.)
- **Generic titles / ugly font:** "כרגע זה נראה ממש ממש גנרי, והפונט בכלל נראה לי לא כזה יפה" (asked for 3D gold
  lettering and a Codex-generated background for an intro in that project).
- **Not cinematic color:** "התמונות שיצאו... הם לא כל כך קולנועיים... שזה יראה פי אלף יותר קולנועי". Bar: dense
  exposure, green/teal environment against warm skin, one accent color, no pure white.
- **Captions placement in a landscape music-video edit:** "את הכתוביות... תשים בחלק התחתון של הקליפ, לא באמצע".
  (Context: 16:9 clip. For 9:16 SYSTM talking heads, captions sit at 64-70% (SYSTM Cut) or 77.5% (Depth).)
- **Speech placement:** "תנתח את הקטעים שבהם יש דיבור... תדאג לחתוך אותם ולמקם אותם במקומות הנכונים... זה קצת
  צורם לעין" → align spoken shots to the lyrics / speech (lip-sync measured shot by shot, drift < 0.15 s).
- **Captions as rendered .mov overlays (in Resolve):** he wants Text+/Fusion titles on the timeline, never .mov.
- **Colorful split-screen AI images, pink/yellow/orange titles, RGB purple/green light, bright backgrounds:**
  this was the "before" state of his feeds; SYSTM Cut replaces all of it (see 2.1).

### 1.3 Brand voice in video copy

- Direct, practical, curious, understandable to non-technical people. A specific process instead of "revolution".
- Key lines: "פחות עומס. יותר עסק." (brand end card), "בוחרים חכם. עובדים אוטומט.", "העסק שלך. המערכת שלך."
- Never invent numbers, client counts, hours saved, ROI, prices, testimonials, client logos. Every number needs a source.
- CTA format: "תגיבו [מילה] ואשלח לכם את המדריך" (comment a keyword, AutoDM sends the guide).
- Labels in English caps with wide tracking: `SYSTM / 02`, `SYSTM / AI SYSTEMS`.

---

## 2. SYSTM Cut (talking-head style) — `brand/video-style.md`

### 2.1 What changed versus his old feeds

| Before | SYSTM Cut |
|---|---|
| Split screen: colorful AI image on top, talking head below | Kept as a format, branded: top = screen recording or card on Carbon inside a glass frame, bottom = presenter, thin Ice line separator |
| Titles in pink/yellow/orange, different font each video | SYSTM Display V2 Black in Paper, one word in Ice. Always |
| Bright, colorful backgrounds, purple/green RGB light | Dark background, one Ice light |
| White shirt on bright background | Light clothing (off-white or cream bomber) on dark background, so the person is the brightest thing |
| Covers all different | Fixed cover structure per series, with series name and episode number |
| Colorful illustrated AI b-roll | Real b-roll (screen, hands) or dark-graded images |
Keep: direct-to-lens talking, energy, expressions, big on-screen title from frame 1.

### 2.2 Shooting guide (for the shoot skill)
- Dark matte background, at least 2 stops darker than the face. No ceiling light, no window behind.
- Soft key from 45°, slightly above eye line, 4300-5000 K; the other side stays in shadow (negative fill).
- One Ice-colored light behind (LED strip, screen, rim on shoulder) — the only accent.
- 9:16, 4K, 30 fps, f/2-2.8, 1/60, locked WB, 24-35 mm equiv. Shoot wider than needed so 112%/125% punch-ins stay sharp.
- Eyes in upper third; keep top fifth free for title, bottom fifth free for platform UI. Tripod; camera never moves.
- Lav or close shotgun, peaks around -12 dB. 2 s of silence at the start of each take (noise print).
- Restart the sentence on mistakes; the edit keeps the LAST clean take. Shoot the hook 3 times, 3 wordings
  (Trial Reels variants). End with 5 s silent look to lens (cover + end card).
- Shot types: talking head, screen recording (dark mode, browser zoom 125%, 60 fps, no notifications),
  over-the-shoulder, hands on keyboard (60 fps), split screen (presenter fills bottom 45%).

### 2.3 Structure
1. Hook 0-2 s, title on screen from frame 1, no "hi, what's up".
2. Promise: one sentence on what you get by the end.
3. Three content beats; something in the picture changes in each.
4. One CTA: "תגיבו [מילה] ואשלח לכם את המדריך".
5. End card 1.5 s: Carbon, white SYSTM logo, "פחות עומס. יותר עסק.", keyword in an Ice pill.
Target length 30-60 s (Reels/TikTok), up to 60 s Shorts.

### 2.4 Cut rules (rough cut)
- Cut on the breath. Keep **2-4 frames before the first word and 4-6 frames after the last**. Never cut mid-syllable.
  A cut that sounds clipped is an error.
- Remove silences > **0.45 s**, duplicate takes (keep the last clean one), fillers, broken starts. Keep a
  deliberate pause before a punch.
- Move the strongest sentence to the opening (hook), even if said in the middle.
- Zoom steps **100% / 112% / 125%**, change only on a cut and only for emphasis. Never a slow continuous zoom, never shake.
- Something changes at least every **8 s** (zoom, card, screen, b-roll). (Depth mode: every 1-1.5 s.)
- Audio crossfade at each cut: 12 ms fades (`afade` in/out d=0.012).

### 2.5 Captions (SYSTM Cut)
- SYSTM Display V2 Black, Paper, RTL, 2-4 words per line, one line (two max).
- The word being said now OR the sentence keyword in Ice, never both.
- Size 76-92 px on a 1080-wide frame; horizontally centered at **64-70% from the top**.
- No black outline. Soft shadow `0 4px 24px rgba(0,0,0,.55)` or a dark glass pill on bright backgrounds.
- Entrance: 8 px blur + 12 px rise settling in 6 frames, curve `cubic-bezier(0.23,1,0.32,1)`. Exit: hard cut.
- Caption appears WITH the word, not after it. If word times came from Gemini (`approxTimes: true`), check timing at ≥3 points.
- **Never build Hebrew captions with ffmpeg `drawtext`**: it breaks RTL (and this Mac's ffmpeg has no drawtext at all).
  Use HTML/Playwright PNGs, aftercode/HyperFrames compositions, or Resolve Text+.

### 2.6 Graphic cards, screen recordings
- Full-frame card: Carbon with grain, small English label (`SYSTM / 02`), huge SYSTM Display V2 Black title, one Ice word.
- **Signature: a thin Ice line that draws across the screen and turns at right angles**; also the section
  transition (line draws, turns, the frame changes behind it).
- Lists/numbers on a glass panel: radius 28, 9% white border, backdrop blur.
- Every element enters from blur, 500-800 ms, 60-90 ms stagger between elements.
- Screen recordings sit inside a rounded card with a thin border on Carbon (never raw full screen). Cursor
  highlighted with an Ice ring. Smooth zoom to region with `cubic-bezier(0.77,0,0.175,1)`. Blur personal
  details, keys and client names.
- Brand motion: one entrance = opacity + 8 px blur clearing in 800 ms. Curves: `0.23,1,0.32,1` (elements),
  `0.77,0,0.175,1` (on-screen movement), `0.32,0.72,0,1` (drawers/cards). Page transitions: blur out 170 ms,
  blur in 320 ms. No bounces, no shakes, no spins. Radii: 8 small, 28 cards, full pill buttons. Grain 5%.

### 2.7 Color (both modes)
- Dense exposure. Blacks sit on Carbon (not crushed to 0); whites stop at 96%.
- Cool shadows leaning teal, warm natural skin. Desaturate everything that isn't skin or Ice.
- Grain 4-6%, light vignette. "Looks like a frame from a film, not bright stock video."
- Tools: DaVinci MCP `generate_lut`, or ffmpeg `eq`, `curves`, `colorbalance`. Compare frame before/after.
- Default ffmpeg grade (Carbon look):
  `curves=r='0/0.02 0.5/0.49 1/0.96':g='0/0.035 0.5/0.5 1/0.96':b='0/0.045 0.5/0.51 1/0.95',vignette=angle=0.42,noise=alls=5:allf=t`
- For generated images: always write an explicit exposure + color-grade block in the prompt (soft motivated
  light, one accent, no pure white), compare by eye and by mean color against references before showing.

### 2.8 Sound (SYSTM Cut)
- Speech: gentle denoise, de-ess, light compression, 12 ms crossfades at cuts.
- SFX soft and low: small click on keyword caption, sub pulse on a card, short whoosh on the line. Every
  graphic move is audible but quiet. No aggressive whooshes, no "ding".
- Music: minimal electronic or ambient, no vocals, **18-24 dB under speech**, dips further on a punch.
- Master **-14 LUFS integrated, -1.5 dBTP** (`loudnorm=I=-14:TP=-1.5:LRA=11`).
- Music/SFX only from licensed sources (Suno, ElevenLabs, libraries Ariel approved, CC0/Mixkit). Never download songs.

### 2.9 Output spec
1080x1920, H.264 High, 30 fps, 12-16 Mbit, AAC 192k 48 kHz, `+faststart`. File name `<project>-v<N>.mp4`.

### 2.10 Pre-review checklist (agent runs it on an 18-frame sheet before Ariel sees anything)
- [ ] First frame has a title and a face, not black.
- [ ] Every caption on time, no typos, RTL.
- [ ] No text in the bottom fifth or under the platform's side buttons.
- [ ] No clipped cut, no volume jump.
- [ ] Ice used sparingly, no other accent color.
- [ ] Logo from an approved file.
- [ ] No number or promise without a source.
Whatever fails is fixed before review, not left for Ariel.

---

## 3. Content OS editing pipeline (`~/content-os`)

### 3.1 Layout
- `projects/<YYYY-MM-DD>-<slug>/`: `raw/` (footage), `work/` (transcript, silences), `edit/` (plan, cuts,
  rough, depth/), `out/vN.mp4` (review versions), `review/notes-vN.json`, `cover/`, `copy/`, `guide/`,
  `publish/`, `status.json`, `meta.json`.
- Stages: `ingested → transcribed → planned → rough_cut → in_review → notes_received → (another round) →
  approved → packaged → scheduled → published → measured`.
- `config.json`: `agent` (`claude` | `codex` | `none`, env override `COS_AGENT`), `publishMode` (`approve`;
  `auto` only if Ariel says so), `stableSeconds: 15`, `geminiModel: "gemini-flash-latest"`, `language: "heb"`.
- Brand source for video and covers: `brand/` (`brand.md`, `video-style.md`, `tokens.css`, `logos/`,
  `fonts/` incl. `SYSTMDisplayV2-Black.ttf` + ExtraBold/Bold/Medium/Regular `.woff2`).
- Lessons: `knowledge/lessons/{edit,cover,script,depth,...}.md`, one line per lesson (date, what was fixed, why).
  Every skill reads its lessons file first; a written lesson overrides defaults.

### 3.2 `engine/cos.mjs` (no dependencies; Node + ffmpeg)
- `new <file...> [--name slug] [--copy]`: creates the project tree, moves raw files in. Several clips of
  one video (a folder in inbox) are concatenated in name order into `raw/_merged.mp4` (scale/pad to first
  clip, fps 30 when ≥50, 48 kHz stereo, crf 14), with `sources[]` offsets in `meta.json`.
- `probe <file>`.
- `transcribe <id> [--lang heb] [--engine auto|elevenlabs|gemini]`: extracts mono 16 kHz 64k mp3, then
  ElevenLabs Scribe (`model_id: scribe_v1`, `timestamps_granularity: word`, no diarize, no audio events;
  key `ELEVENLABS_API_KEY`). **Fallback: Gemini** (`GEMINI_API_KEY`, model from config) with inline audio,
  `responseMimeType: application/json`, temperature 0, prompt "verbatim, including repeated takes and filler
  words", returns `[{t,s,e}]`; sets `approxTimes: true`. Sentences split on punctuation or a pause > 0.6 s.
  Writes `work/transcript.json` + `work/transcript.md` (`[i] s-e text`).
- `silences <id> [--db -32] [--min 0.45]`: `silencedetect=noise=-32dB:d=0.45` → `work/silences.json`.
  **Use `spawnSync` and read stderr**; `execFileSync` stderr capture was unreliable.
- `cut <id>`: renders `edit/cuts.json` `{"crop":"9:16","segments":[{"s":1.20,"e":4.85,"note":"hook"}]}`
  → `edit/rough.mp4` (trim/atrim per segment, 12 ms afades, concat, crop landscape to `ih*9/16:ih`, scale/crop
  1080x1920, fps 30, `loudnorm=I=-14:TP=-1.5:LRA=11`, x264 crf 17, AAC 192k 48k, faststart) and remaps word
  times to the new timeline → `edit/words.json`.
  **Gotcha:** the remap only keeps words fully inside a segment (±0.02 s), so words at segment boundaries are
  DROPPED (seen: "בלי", "PDF", "שיחה", "זהו", "ביי"). For anything caption-critical, **re-transcribe the cut
  file itself** (`depth.mjs words`) instead of trusting the remap.
- `sheet <video> [--n 12] [--out f.jpg]`: contact sheet (`fps=n/dur, scale=270 (portrait), tile=6xN`).
  The agent reads the image to "watch" the cut. Use `--n 18` for the pre-review check.
- `frame <video> <seconds> [out.jpg]`: single frame, to look at a suspicious cut or a note.
- `version <id> <file>`: copies to `out/vN.mp4`, stage `in_review`.
- `review <id> [--port 4455]`: local frame-accurate review room (`review-server.mjs`, `review.html`). Ariel
  stops on a frame, writes what he sees and what he wants instead, sends all notes together → `review/notes-vN.json`
  (`kind`, `frame`, `time`, `endTime`, `text`), stage `notes_received`; or "approved, no notes" → `approved`.
- `stage <id> <stage>`: set by hand (agents end at `packaged`).
- `status`, `watch` (see 3.4).

### 3.3 Editing skill flow (`content-edit`)
1. Plan from `work/transcript.json` + `work/silences.json`: `edit/plan.md` (table: time, what's said, what we
   see (zoom 100/112/125, card, screen, b-roll), key caption, sound) and `edit/cuts.json`.
2. Rough cut: `cos.mjs cut`, then `sheet edit/rough.mp4`, read it, check suspicious cuts with `frame`.
3. Graphics over `rough.mp4` at 1080x1920@30: captions from `words.json`, zoom steps, title cards, Ice line,
   screen recordings in cards, end card with keyword. Tools: `aftercode-footage` (video layer + time-computed
   graphics + motion blur), `aftercode-kinetic-type` (cards), or HyperFrames. Fonts/logos/colors from `brand/`.
   - **Depth mode**: if Ariel asks for "עריכת עומק", or the script/ideas mark `edit: "depth"`, after step 2
     switch to `systm-depth` instead of step 3 (grade + sound are included in `depth.mjs finish`).
4. Color + sound (2.7, 2.8).
5. Register with `cos.mjs version`, after the checklist on an 18-frame sheet.
- **Revision round:** a new version is built from the same sources (`cuts.json`, the composition), never from
  the previous master. Change only what the notes asked for and what follows from them.

### 3.4 Watcher and approval flow (never publish without approval)
- launchd agent watches `inbox/` (WatchPaths + StartInterval 600 + ThrottleInterval 20). `cos.mjs watch`
  takes a lock (`logs/watch.lock`, stale after 3 h), waits `stableSeconds` and re-checks file sizes (still
  copying?), creates the project, and hands it to the agent:
  - Claude: `claude -p "<prompt>" --permission-mode acceptEdits` (cwd `~/content-os`).
  - Codex: `codex exec --skip-git-repo-check -s workspace-write -C ~/content-os "<prompt>"` (`--full-auto`
    does not exist).
  - Prompt: "new raw video... run content-pipeline from start to the review stage. publish mode: approve".
- Follow-ups: projects in `notes_received` or `approved` are handed to the agent **once per version** using an
  `agentDone: "<stage>@v<N>"` marker in `status.json`.
  - notes → `content-edit`, fix every note, register a new version.
  - approved → cover (if missing), package (captions), Trial Reels variants in `out/trial/` + `publish/trial.json`,
    full `publish/autodm.json`; "do not publish or schedule yourself"; end with `cos.mjs stage <id> packaged`.
- Ariel presses publish/schedule in the Studio app. Publishing refuses projects that aren't approved;
  each send is logged once and an "unknown" status blocks retries. AutoDM wording needs his explicit approval.
  Never post via a logged-in browser.
- Headless Claude in a new folder says "workspace has not been trusted" and ignores `.claude/settings.json`
  permissions until Ariel runs `claude` interactively there once and accepts the trust dialog.

### 3.5 Review skill rules (`content-review`)
- For each note: extract the frame (`cos.mjs frame out/vN.mp4 <time>`) and read it before fixing.
- Write `review/plan-v<N+1>.md` (per note: what changes, which file). Unclear note: pick the reasonable
  reading, flag it as a question, don't stall the round.
- Fix everything in one round. A note that states a principle ("the caption is late") applies to the whole
  video, not only the marked frame.
- Check each note against the new frame; report what was fixed and what's still a question.
- Turn general notes into lessons (`content-learn` → `knowledge/lessons/edit.md`).
- Audit mode (second agent, e.g. Codex, before Ariel sees it): 18-frame sheet + checklist → `review/audit-vN.json`
  in the notes format; never fixes and never approves.
- "A precise note on a frame teaches more than 'this isn't good'."

### 3.6 Learning loop facts that matter for editing
- Data across ~53 videos: the gap between top and bottom reels was **watch %** (18.3% vs 7.5%), not the
  3-second hold (45% vs 39.5%). Editing for retention through the whole video matters more than the hook alone.
- Open experiments that touch editing: length 50-85 s; a spoken opening instead of music only.
- Hook transcription of published reels: `yt-dlp --download-sections "*0-8" -x --audio-format mp3` works for
  both TikTok and Instagram.

---

## 4. Covers (`content-cover`)
- 1080x1920; all text inside the central **1080x1350** (what shows in the profile grid). YouTube 1280x720 same language.
- Background: a graded frame from the video (pick from 5-8 `frame` grabs: eyes open, expression; or the
  5 silent seconds at the end of the shoot), or a portrait on Carbon. Face on one side, title on the other.
- Title 2-4 words from the hook, SYSTM Display V2 Black, one word in Ice; 3 wording options.
- Small label above: series name + episode (`כלי בשתי דקות / 07`). Small logo in a corner. One Ice line.
- Build as HTML with `tokens.css`, fonts and SVG logo; screenshot with Playwright at `deviceScaleFactor: 1`
  → `cover/cover-a.png`, `-b`, `-c`, `cover/yt-1280x720.png`.
- Check by eye: shrink to 270 px wide, title still readable, RTL correct, no clipped letter.
- Never generate the logo or Hebrew text with an image model; text and logo are always an HTML layer.
- Generated background (no good frame): Seedream with an explicit exposure + grade block; social brand
  background = smoked glass panel in the lower third with Ice edge, calm upper half for the title; no text,
  no robots, no purple.
- Same structure for every episode of a series so the audience recognizes it in the grid.
- Do not use Ariel's childhood photos publicly.

---

## 5. SYSTM Depth: the technique

### 5.1 Concept (Ariel's description)
"הרכבה של חתיכות תמונה במרחב תלת מימדי. אין פה מודל וידאו. קלוד מרכיב הכל עם בלנדר." Use the Codex plugin
(image model) "עבור יצירת השכבות לכל קטע וקטע". Reference: 7 reels by Elhanan Porten (Instagram IDs
Dfjz9v-i9Ux, Dfcp_7ji83G, DfLG0CiCoRZ, DfCGdbUCA_K, De6bhCMiKX2, DezniLgiOe9, DerHAdpiAWj), all 1080x1920,
30 fps, 43-84 s. Each beat is a "set": deep background, set pieces, one hero object, cards, title, near-camera
elements, each a separate AI image on a plane at its own depth; a Blender camera travels between them.

### 5.2 How the references were analyzed (reproducible)
- Download with yt-dlp into `research/depth-refs/r1..r7.mp4` (+ info.json).
- Contact sheets: 1 frame per 1.5 s, 8 columns (`sheet1-7.jpg`).
- Detect transition points by **per-frame change magnitude** (not only hard-cut detection), because most
  transitions are continuous camera moves.
- "Strips": 8x2 tiles of 16 consecutive frames at 180x320 around each event (t-strips = consecutive frames,
  m-strips = every 2nd frame), 61 strips + `index.txt` with start times (no burned-in timecode because
  ffmpeg has no drawtext here).
- Measure in frame fractions (W, H) ±0.02; difference images to measure camera motion.
- Split across 3 parallel subagents (r1-2, r3-5, r6-7), each reads all strips and pulls extra 0.1 s-step strips.

### 5.3 Reference findings: art direction
- One coherent "world" per video (palette, materials, light fixed from first to last frame): r1 cream studio
  with green velvet, clouds, glossy green clay objects, glass UI pills; r2 vintage engravings on textured color
  fields (color changes per section = chapter marker); r3 navy/yellow stage; r4 dark concrete + pink light shaft,
  then pale mint; r5 warm amber film-noir desks with red accent; r6 mint clinic (Wes Anderson); r7 terracotta,
  amber, corridors, library.
- Grammar shared by all: background plate, 1-3 hero objects/cards, top title, small word-by-word captions,
  presenter cut out at the bottom. Limited 3-color palette per reel. Vignette common. No light leaks.
- Baked volumetric light shafts, god-rays, leaf/window shadows, light pools in the backgrounds; haze/fog
  layers; floating dust/bokeh.

### 5.4 Reference findings: transitions (frame counts at 30 fps)
- **Almost no plain hard cuts.** Every cut carries momentum: (a) ease-in push into the cut + ease-out after,
  (b) a 1-frame white or black flash/dip, or (c) a whip with 3-5 blurred frames.
- **Momentum push (the house cut):** ease-in push ~1→2x over ~5 frames, cut, the new shot lands **1.6-2.2x too
  close and defocused**, then ease-out pull back to 1.0 over **6-9 frames** while focus racks in (settled ~frame 11-12).
- **Whip (horizontal or vertical):** 4-9 frames total, motion blur on 3-5 of them, accelerate out, the new
  scene arrives from the opposite edge and decelerates. r1 house whip: ~6 frames accelerating out (blur f3-6),
  hard cut on f7, ~5-6 frames of incoming settle (~0.4 s total). Vertical whips use stepped "echo" blur
  (4-6 discrete ghost copies), which reads deliberate and graphic.
- **Foreground parallax in whips:** a near layer (curtain, seats, clouds) moves **2-3x faster** than the rest
  and sweeps across **40-55% of the frame** (e.g. curtain x 0.95→0.88→0.78→0.65→0.55 over f2-6). That speed
  difference is what reads as 3D.
- **Presenter carries the whip's momentum:** arrives offset **~0.1-0.2W** in the travel direction, blurred for
  the first 2 frames, decelerates to rest in ~5-6 frames (head x 0.83→0.74→0.72…→0.63).
- **Panel slides:** adjacent panels with a hard seam (thin white or shadow sliver). Seam y per frame example:
  0.82, 0.75, 0.69, 0.62, 0.55, 0.47, 0.38, 0.30, 0.22, 0.18, 0.14, 0.11, 0.08, 0.06, 0.04, 0.03 — peak ~8% H
  per frame then a long ~8-frame ease-out tail.
- **Dive / zoom-through a card:** push into the card ~1.0→2.5x over ~7-8 frames, accelerating, border passes
  the frame edges; hard cut to a near-white hazy frame or a 1-2 frame crossfade; new scene materializes from
  haze over ~8 frames.
- **Push-through-object:** front card flies to the lens 1.0→1.3→3x over 3 frames with DOF blur (not
  directional blur), hard cut on frame 7.
- **Object wipe / throw-through:** an out-of-focus object flies in, covers ~50% by f7, cut, the same object
  continues flying away in the new scene (45%→25% width over f8-16).
- **Flashes:** white flash 1 frame (frames 7-8 fade back from white, desaturated), cream bloom peaking 1 frame,
  red bloom 4 frames for drama; dip to black 1 frame then fade up over ~3 frames.
- **Others:** iris reveal (feathered disc ~3% W softness from 0.1W, 16+ frames ease-in), particle disintegration
  of a title (12-15 frames) then white dissolve (6-9 frames), abstraction match-cut (detailed page → schematic
  version at 2x and -8° roll, pull back and de-roll to -2°), push into a phone screen that matches the next
  phone's screen (2.2x then ease-out pull back).
- New scenes often arrive defocused and sharpen over **3-4 frames**.
- Distribution in r3-r5: vertical whips ~6/18, hard cut + immediate element animation ~7/18, zoom/dive 2,
  object wipe 1, color flash 1, horizontal push 1.

### 5.5 Reference findings: camera inside shots
- **The camera never stops.** Linear slow drift, typically **2-5% scale per second**; emphasis pushes 8-12%/s,
  up to ~25%/s. Slow roll/orbit 2-5°/s on tabletop/overhead plates.
- In-shot motion is linear-feeling; easing is concentrated around transitions. Entries/exits always ease-out.
- A blurred near-foreground layer in almost every shot at **15-25% of the frame edge** (pole, cup, lamp, plant,
  phoropter) so near and far separate during the drift.
- Secondary object motion keeps "static" shots alive: slow 10-15° yaw on 3D numerals, orbiting ribbons,
  drifting fog, rising bubbles, rotating gears, pendulum tags, video playing inside cards.
- No handheld shake anywhere.

### 5.6 Reference findings: element animation
- **Pop / blur-scale in:** from ~60-70% scale at ~30% opacity with heavy blur to 100% over **6-8 frames**,
  rising 3-5% H, ease-out, **no overshoot** (< 2% if any).
- **Staggers:** ~2 frames between grouped items; ~14 frames (0.47 s) between paired props; hero first, then
  presenter, then title (2-3 frames each).
- **Drops:** 2-6 frames with vertical ghost blur, land with no bounce (stacking floors fall in 3 frames each).
- **Slides:** ~0.4W in ~10 frames with horizontal blur, decelerating; layout reflows to make room.
- **Card flip:** edge-on sliver, turns ~90° on Y to face camera over ~6 frames; selected card swings forward
  with visible thickness, scales 1.3x, others darken to ~30%.
- **Write-on:** handwritten accent words over 7-10 frames, ~2 frames after the main event; typewriter
  ~1 character per 2 frames; highlighter bars 6-10 frames per phrase, a new phrase every 0.5-0.7 s.
- **UI/screenshots are physical objects:** white mat/border + drop shadow, hung on wires with a museum label,
  held in hands, taped to walls, lying on a desk; enter with the 90° Y flip or slide in, staggered 0.3-0.5 s,
  and keep playing their own content.
- **Fade + de-blur** for in-scene numbers/words: 5-8 frames.
- Exits: same direction at high speed with echo blur in ~3-4 frames, or leave with the scene.

### 5.7 Reference findings: typography
- Titles: 1-3 words (up to 4-5 in r2), heavy (condensed) sans, **55-75% of frame width**, top band centered at
  **0.12-0.25H** (some at 0.45-0.6H just above the presenter's head). Two-tone: one accent word in color.
- Build word by word synced to speech; a new word shows as a grey/blurred ghost for 1 frame, solid by 2-4 frames.
- Entries: fade + blur-in over 5-8 frames; typewriter; riding in with a whip; bloom flash on first frame
  decaying over 3 frames. Exits: blur-out/fade ~3 frames (or 6-8 frames before a move), particle dissolve.
- **Titles mostly belong to the scene** (mid-depth): they leave with the set during transitions, objects can
  occlude them (a stamp passes in front; a ribbon wraps in front and behind). Some are composited into the
  scene semi-transparent (~60% opacity, blended onto stone). Some hero words are extruded 3D or gold.
- Lockup: small kicker above, big title, small subline building word by word below.
- Small handwritten line above the title (0.2-0.35W wide at ~0.15H), write-on ~6 frames. (SYSTM version:
  no handwriting.)
- **Captions:** tiny, cap height ~2-4% (≈2.5% H), plain white sans with slight shadow, **no box**, 1-4 words
  that accumulate word by word and reset at phrase end, line width only 0.3-0.5W, **screen-locked**, never
  transition, often switch on the cut frame. Height ~0.73-0.81H (over the chest), or ~0.58-0.6H just above
  the head when the layout needs it. Active word optionally highlighted.

### 5.8 Reference findings: presenter
- Always a clean cutout (slightly soft matte, no outline, no glow, no visible shadow), torso cropped by the
  bottom edge, centered.
- **Head width ~0.17-0.30W** (r3 28-30%, r1 23%, r4-5 22%, r6 19-21%, r7 17-19%); **top of head ~0.48-0.72H**.
- Absent **35-50% of runtime** (object/macro/corridor beats).
- Enters by **rising from the bottom over ~6 frames, ease-out** (head y 590→570→552→545→540→537→535 px), or
  scaling 60→100% at an opening; in whips he stays locked or carries momentum. Zoom on him is rare
  (one 15-20% punch-in in 6 frames with zoom blur).
- Color-matched per scene (warm, neutral, low-key) so he reads as standing in the space.
- **Sandwiched between depth layers:** fog/clouds in front of and behind him, objects standing on his head.

### 5.9 Reference findings: rhythm
- A scene change every **2.8-4 s** (r6 17 scenes / 47.8 s, r7 15 / 51.6 s, r1 20 / 80 s, r2 15 / 55 s).
- A new visual event (title word, card, label, highlight, pop) every **1-1.5 s**.
- Caption words change every 6-10 frames (every spoken word).
- Title words, stamps and pop-ins land exactly on the spoken keyword; transitions start on phrase boundaries.

### 5.10 The "five secrets" (merged from all three analyses)
1. Every cut carries momentum (push → land too close and soft → ease-out settle with rack focus), with flash,
   dip or whip only on top.
2. Whips with a foreground layer 2-3x faster covering 40-55% of the frame; directional blur only in whips,
   defocus in push-throughs.
3. The camera never stops: 2-5%/s linear drift plus a blurred near layer at an edge; real Z distance between
   layers so the push creates parallax.
4. Every entrance is blurred and eased, never a hard pop: 65%→100%, 6-8 frames, staggered ~2 frames.
5. Type driven by speech: titles in scene space building word by word; captions alone screen-locked, tiny,
   word-synced. UI as physical objects. Presenter rises from the bottom over ~6 frames.

---

## 6. SYSTM Depth: the SYSTM version (what makes it ours)

- Always dark: Carbon shadows with detail, soft warm-neutral key, exactly **one Ice light**. No other accent:
  no purple, yellow or red.
- Materials = "the SYSTM object": matte off-white ceramic with soft clay-like forms, frosted glass, brushed
  graphite, paper.
- Titles SYSTM Display V2 Black in Paper, one word in Ice. No handwriting, no other colors.
- Captions SYSTM Display V2 ExtraBold, small (~64 px), 2-3 words building word by word, keyword in Ice, at
  **77.5% from the top** (chest).
- Signature transition: thin Ice line crossing the frame (`transition: "line"`), once or twice per video,
  between sections (after the hook, before the CTA).
- Grade: cool shadows, whites to 96%, grain ~5%, light vignette (automatic in `finish`).
- End: "תגיבו" + one keyword in an Ice pill.

### 6.1 Looks (each video a different one) and signature marks (never change)
`style.json` `looks` (art direction appended to every Codex prompt; grade; title Y and size; fstop; motion
multiplier; transition mix; music mood):

| look | name | art direction (short) | titleY / size | fstop | motion | transitions | music |
|---|---|---|---|---|---|---|---|
| carbon | Carbon Lab | dark interiors, raw concrete, frosted glass, practicals, 35 mm still | 0.12 / 112 | 4 | 1.0 | push, whip-l/r, dive, flash, line | dark minimal pulse |
| paper | Paper Diorama | layered paper-cut diorama, visible cut edges, tilt-shift macro, one Ice paper accent | 0.14 / 120 | 2.8 | 0.8 | push, dive, whip-down, line, dip | soft piano and sub |
| vitrine | Museum Vitrine | objects as exhibits in glass vitrines on dark pedestals, black velvet, top spots | 0.10 / 104 | 2.4 | 0.7 | push, dive, line, dip | cinematic tension |
| blueprint | Blueprint Model | white architectural models, translucent acrylic, graphite drafting, Ice lines/grid | 0.12 / 108 | 3.2 | 1.1 | whip-l/r/up, push, line, flash | minimal tech groove |
| chrome | Liquid Chrome | polished chrome and smoked glass sculptures in a void, strip-light highlights | 0.11 / 116 | 3.5 | 1.25 | whip-l/r, flash, push, dive, line | upbeat electronic |
| nightcity | Night Miniature | miniature night city, tilt-shift, wet streets, warm windows, Ice street lights | 0.13 / 112 | 2.6 | 1.1 | push, whip-left, dive, line, flash | lo-fi electronic |
| clay | Soft Clay | soft matte clay/ceramic, rounded friendly forms, stop-motion feel | 0.13 / 120 | 3 | 0.9 | push, whip-down/up, dive, line | playful minimal |
| monolith | Brutal Monolith | vast brutalist spaces, graphite monoliths, light shafts, fog | 0.10 / 124 | 4.5 | 1.3 | dive, push, flash, whip-up, line, dip | cinematic tension build |

Per-look ffmpeg grades (examples):
- paper: `curves=all='0/0.04 0.5/0.52 1/0.97',eq=saturation=0.85,vignette=angle=0.35,noise=alls=6:allf=t`
- vitrine: `curves=all='0/0.0 0.5/0.47 1/0.95',eq=contrast=1.08:saturation=0.8,vignette=angle=0.5,noise=alls=4:allf=t`
- blueprint: `curves=b='0/0.06 0.5/0.53 1/0.97',eq=saturation=0.75,vignette=angle=0.38,noise=alls=4:allf=t`
- chrome: `curves=all='0/0.0 0.5/0.48 1/0.98',eq=contrast=1.1:saturation=0.7,vignette=angle=0.45,noise=alls=4:allf=t`
- monolith: `curves=all='0/0.0 0.5/0.46 1/0.95',eq=contrast=1.12:saturation=0.7,vignette=angle=0.5,noise=alls=7:allf=t`

Choosing a look: check the last 7 projects (`grep -h '"look"' projects/*/edit/depth/plan.json`) and pick one
not used there that fits the topic.

**Signature marks (in every look; "this is what can't be copied"):**
1. Ice `#acf4f8` as the only accent in every layer, title and caption.
2. SYSTM Display V2 (proprietary, not available to others) for all text.
3. At least one `line` transition, with the signature sound.
4. The SYSTM sonic signature (produced by us, not stock) on the line and at the end of every video.
5. The hallmark object in at least one beat (hero or mid): prompt `"the SYSTM hallmark: a small matte
   off-white ceramic monolith with a single thin glowing ice-cyan seam"`.
6. Film grain and cool shadows in every grade.

### 6.2 Worlds (a second axis, one per video)
`gallery` (dark museum hall, polished black concrete, warm pools, Ice strip far away), `studio` (dark
editorial studio at night, brass lamp, monitor Ice glow), `archive` (graphite shelves and paper files receding,
Ice light at far end), `void` (infinite carbon void, glossy floor, Ice pool from above), `lab` (brutalist
concrete and frosted glass, Ice practicals, warm work surfaces), `city` (night city from a high window, blue hour).
Choose by topic: studio = daily work, archive = info/documents, lab = tech/automation, gallery = results,
void = abstract idea, city = market/customers. `worldLook` free text only if none fits. Write one line in
`edit/depth/notes.md` on why.

---

## 7. SYSTM Depth: pipeline and commands (`engine/depth/depth.mjs`)

Everything lives in `projects/<id>/edit/depth/`. Order:
1. Source: project after `cos.mjs transcribe` + `cut` (`edit/rough.mp4`, `edit/words.json`); or raw.
2. `depth.mjs init <id> [--src f] [--rotate cw|ccw|180]` → `src.mp4` 1080x1920@30
   (`scale=...:force_original_aspect_ratio=increase,crop=1080:1920,fps=30`, x264 crf 16, `-g 15`, AAC 192k 48k),
   `words.json`, `transcript.txt` (one line per sentence: split on punctuation or gap > 0.45 s), skeleton `plan.json`.
   Phone footage saved sideways: `--rotate ccw` (`transpose=2`).
3. `depth.mjs words <id>`: **re-transcribe `src.mp4` itself** (ElevenLabs Scribe, else Gemini) so word times
   match the cut exactly (fixes the dropped-words remap bug).
4. `depth.mjs matte <id> [--fast]`: presenter mattes (Apple Vision), run in background while planning.
5. Plan (`systm-depth-plan` skill) → `plan.json`; `depth.mjs check <id>` until `plan ok`.
6. `depth.mjs layers <id> [--jobs 3] [--only b4] [--redo b4-cloud,b6-clock]` → `layers/*.png` + `layers/sheet.jpg`.
7. `depth.mjs text <id>` → `text/*.png` + `text/index.json`.
8. `depth.mjs stills <id> --preview [--at 3.2,8]` → one frame per beat, all 4 passes stacked,
   `stills/sheet.jpg`. **Look at it before any full render.**
9. `depth.mjs open <id> [--frame N]` → saves `scene.blend`, opens Blender GUI with `viewer.py`.
10. `depth.mjs render <id> --preview` + `finish --preview` (half res) → `cos.mjs sheet depth-preview.mp4 --n 18`.
11. Final: `render <id>` + `finish <id>` (background). Partial re-render: `render <id> --from 12 --to 16`, then finish.
    `--passes world,text` renders only some passes.
12. `cos.mjs version <id> edit/depth/depth-vN.mp4` → normal review room.
`run` = layers + text + render + finish.

Budget: Codex layer 45-90 s each, 3 in parallel; a 40 s video ≈ 10-12 beats, 25-35 layers, 15-25 min painting
(16 layers took ~5.5 min with 3 jobs; 22 paintings ran in background fine). Matte ~0.5 s/frame.

### 7.1 The `plan.json` contract
```json
{
  "duration": 31.4, "world": "archive", "look": "carbon",
  "keywords": ["שכבות", "עומק", "קלוד"], "captions": true,
  "music": "<bank id or false>", "musicGain": 0.22,
  "beats": [
    { "id": "b1", "start": 0, "end": 3.2, "presenter": "bottom",
      "camera": { "move": "push", "amount": 1 }, "transition": "cut",
      "title": { "text": "כולם עורכים עם קלוד", "accent": "קלוד", "kicker": "", "at": 0.1 },
      "layers": [
        { "id": "bg", "role": "bg", "prompt": "a long dark archive corridor ..." },
        { "id": "shelf", "role": "mid", "prompt": "a graphite shelf unit with paper files", "x": -0.75, "y": -0.1, "h": 0.9 },
        { "id": "hero", "role": "hero", "prompt": "a matte ceramic film clapper ...", "anim": "pop", "at": 0.3 },
        { "id": "dust", "role": "fg", "prompt": "a few loose paper sheets drifting", "x": 0.6, "y": 0.5, "h": 0.5, "anim": "fade" }
      ] } ] }
```
Times in seconds on the `src.mp4` timeline; positions and sizes in **frame units**, not meters (the engine
computes the 3D).

Beat fields:
- `start`, `end`: back to back from 0 to `duration` (validator error if a gap > 0.05 s or end mismatch > 0.1 s).
  1.2-6 s each (warn < 0.8 s, warn > 8 s). Boundaries on sentence boundaries, never mid-word.
- `presenter`: `bottom` (default) / `full` (original video full screen, title screen-locked, used once for an
  emotional punch with `zoom: 1.12`) / `none` (b-roll in the world, 2-4 times per video).
- `zoom`: 1, 1.12, 1.25 (presenter scale, emphasis only).
- `camera.move`: `push`, `pull`, `truck-left`, `truck-right`, `rise`, `fall`, `orbit`, `dolly` (2x push),
  `roll`, `static`; `amount` 0.5-1.6 (multiplied by look `motion`). Don't repeat the same move twice in a row.
  `truck` when there's mid/fg (parallax); `orbit` for a single hero; `dolly` for presenter-less beats.
- `transition` (INTO this beat): `push` (default good cut with momentum), `whip-left|right|up|down`
  (`whip` = left; 2-3 per video, alternating directions, for counting or change of direction), `dive` (through
  the previous hero with white haze, 1-2), `flash` (white 2-4 frames, for a number or punch), `dip` (black),
  `line` (Ice line, between sections), `cut` (first beat only).
- `fstop` 2-8 (default 4; 2.8 for a strongly isolated hero); `focus` depth (default the hero's z).
- `title`: `text` (1-4 words; the idea's headline, not the caption verbatim), `accent` (one word), `kicker`,
  `pill` (Ice pill; last beat `{"text":"תגיבו","pill":"<word>"}`), `at`, `build` (false = enter whole, e.g. a
  number), `space` (`world` default at depth 11 behind the hero; `screen`), `z`, `y`, `size`.
- Last beat: `presenter: "bottom"`, move `push`, the CTA title+pill.

Layer fields:
- `role`: `bg` (required in every non-`full` beat), `mid`, `hero`, `card`, `fg`. Default depths:
  **bg 30, mid 16, title 11, hero 7, card 6, fg 3.2**.
- `prompt` (English, content only; style/world/role rules are appended), `reuse: "b1-bg"` (same image from an
  earlier beat: continuity and saves painting), `file` (real screenshot/product image as `card`, in `assets/`).
- `x`, `y` in -1..1 frame units (y=1 top); hero `y` 0.1-0.25 (above the head); `h` 0-1.2 as a fraction of
  frame height (hero 0.3-0.45 solo, ~0.22-0.28 with presenter); `mid` at the sides x ±0.6-0.85; `fg` in a corner
  or at the edges (x ±1.0-1.12, h 1.25 worked).
- `z` only to override depth (z changes depth, NOT apparent size: `h` is in frame units).
- `anim`: `pop`, `rise`, `drop`, `slide-left`, `slide-right`, `flip`, `zoom`, `fade`, `none`; `at` seconds from
  beat start (put the hero's `at` on the word it represents, from `words.json`); `out` seconds to exit.
- `float` (default true for hero/card), `spin` °/s, `tilt` °, `roll` °, `gain` (brightness 1.1-1.3 if too dark;
  don't change the grade), `front` (passes in front of presenter; default for fg), `aspect` (e.g. `"wide landscape 3:2"`).
- 2-4 layers per beat; more becomes noise. 30-45 s video: 8-12 beats (52.8 s test: 16 beats).
- Hero = one physical metaphor per sentence (morning = coffee cup, waiting = hourglass, order = drawers,
  automation = ceramic gears, clients = cards, money = ceramic coins, invoice untouched = mouse under a glass
  dome). A physical metaphor beats an abstract concept.

Example beats from the real test (52.8 s, world `lab`, keywords חשבונית/אוטומציה/PDF/חודשיים/אחת):
b1 push/cut "חשבונית ב-10 שניות" phone hero pop y0.22 h0.27 + glass fg; b2 truck-left 0.55, transition push;
b3 whip-left, bubble hero + pillar fg; b4 presenter none, dolly, **flash** on "3,500 ₪", coins `drop` h0.42;
b5 orbit, gears; b6 none, dolly 1.1, **dive**, doc card `flip` + chips mid; b7 whip-right, paper plane
slide-right; b8 **full** presenter; b9 pull, **line**; b10 none, truck-right, whip-up; b11 push 1.2, card flip;
b12 orbit, dive; b13 truck-right, whip-left; b14 push, flash, calendar drop; b15 pull, line, stamp pop;
b16 push 1.3 CTA.

### 7.2 Codex image_gen layer workflow
- Command: `codex exec --skip-git-repo-check --json -s workspace-write --ephemeral -` with `-i anchor.png` per
  reference, the prompt on stdin, cwd = a fresh temp dir (mkdtemp). Uses Ariel's ChatGPT/Codex subscription
  (no API key). If not logged in: `codex login`. No silent fallback to another model.
- Prompt wrapper: "Use the built-in image generation tool (image_gen) to generate exactly ONE image. Do not use
  any other tool and do not write any files." + (if anchor) "The attached image is the STYLE ANCHOR of this video:
  match its lighting, palette, color grade, grain and material rendering exactly. Do NOT copy its content or
  composition." + `Aspect ratio: ...` + (transparent) "The output MUST have a transparent background (real alpha
  channel)." + `IMAGE PROMPT:` + prompt + "reply with the single word DONE".
- Full prompt = `style.base` + look art + world + role rule + layer prompt.
  - base: "Cinematic film still, photoreal, shot on ARRI Alexa 35, 35mm lens, Kodak Vision3 500T grade, fine
    film grain, soft halation. Low-key lighting: deep carbon-black shadows (#080c0e) that keep detail, one soft
    warm-neutral key light, and exactly ONE cool ice-cyan accent light (#acf4f8). Restrained palette ...
    everything desaturated except skin and the ice accent. Materials: matte off-white ceramic ..., frosted glass,
    brushed graphite metal, paper. Premium, quiet, editorial. No text, no letters, no numbers, no logos, no
    watermark, no people unless asked."
  - bg rule: full-bleed 9:16 plate, deep perspective receding far so a camera can travel in, **keep CENTER and
    UPPER-MIDDLE calm and empty** (object + title go there), nothing touching the camera.
  - mid/hero/card/fg rules: single isolated item, **TRANSPARENT BACKGROUND with a real alpha channel (PNG)**,
    no floor, no backdrop, no cast-shadow plane, fully inside the frame with a margin on every side. Card text
    "exactly the text given, otherwise blank". fg = loose elements very close to camera, out of focus.
- Aspect: bg "tall vertical portrait 9:16 (or the tallest portrait size available)", others "square 1:1".
- Output location: `~/.codex/generated_images/<thread_id>/` where `thread_id` comes from the `thread.started`
  JSON event on stdout; take the newest image with mtime ≥ start-2 s and copy it out. 10-minute kill timeout.
  Filter `rmcp`/MCP noise from stderr (e.g. a harmless "worker quit ... HTTP 404" line from an MCP transport).
- **Style anchor:** the first `bg` of the video is painted first and becomes the anchor, attached to every
  other layer so light, color and grain match. Fix the anchor first (`--redo b1-bg`) if it's off, then the rest.
  **Backgrounds do NOT get the anchor by default** (`useAnchor = l.anchor ?? role !== 'bg'`): with the anchor the
  model copied its composition; the style text alone unifies backgrounds.
- **Transparency check:** compute the share of near-clear alpha pixels (alpha < 10). If < 3%, the model returned
  no alpha → cut the subject out with Apple Vision `matte lift`. Then **trim transparent margins** (bbox of
  alpha > 8, 2% padding) so `h` in the plan = the object's own height.
- Retry each layer once (2 attempts), then fail loudly. Existing layers aren't repainted.
- Contact sheet: PIL, transparent layers composited on **mid grey** (96,102,104) tiles of 300 px, 6 columns,
  file name under each tile. (A sheet that ignores alpha shows black/fringes around objects and misleads you
  into thinking alpha is missing.)
- Layer review checklist: same world (dark, one warm light, one Ice) else repaint; transparent object is one,
  complete, no backdrop/floor, not cut at the edge; bg calm center + deep recession + nothing competing with the
  hero; no text/letters/logos/people; hero says the sentence at a glance. Fix: one exact sentence in the prompt
  about what was wrong + `--redo`. Max 2 rounds per layer, then change the object.
- Never ask the model for readable UI or Hebrew text; use a blank card + title layer, or a real screenshot as `file`.
- No people, no third-party logos in prompts.

### 7.3 Apple Vision matting (`matte.swift`, compiled with `swiftc -O`)
- `matte person <framesDir> <outDir> [accurate|balanced]`: `VNGeneratePersonSegmentationRequest`,
  qualityLevel accurate (~0.5 s/frame on M3) or balanced (`--fast`, drafts). Grayscale PNG per frame.
  **Temporal smoothing:** blend with the previous matte via `CIDissolveTransition` at time 0.7 (70/30) to
  kill flicker.
- Frames are extracted first at 720x1280 JPEG q3 (`_frames/`, deleted afterwards). Skip if mattes already ≥ frames-1.
- `matte lift <in.png> <out.png>`: `VNGenerateForegroundInstanceMaskRequest` → RGBA cutout of the main subject
  (fallback for AI layers without alpha). rembg was not installed; Vision needs nothing extra.
- In Blender the matte drives alpha through a Map Range 0.2→0.9 (crisp, slightly soft edge, no halo).
- Check: no bright halo and no disappearing hand; if seen, rerun without `--fast`.
- Good footage for this: dark background, fixed frame (tripod), light shirt.

### 7.4 Presenter auto-framing (`framing()`)
- Sample every 15th matte; binarize > 128; bbox; skip tiny boxes (< 2% of frame).
- Head width = the **contiguous run** of matte pixels in the row at `top + 0.06H`, starting from the center of
  the top row. (Measuring the whole row caught a raised hand → wrong scale.)
- Median of top, bottom, center x, head width → cached `framing.json`.
- Scale `s = max(presenterHead / head, (1 - presenterTop) / (bottom - top))`, capped at 2.4, so the head is
  ~18% of frame width AND the body still runs off the bottom edge. Defaults **presenterTop 0.52,
  presenterHead 0.18**. A fixed `presenterScale` in the plan overrides it (it did, by mistake; remove it).
- Layout fractions from the top: title 12-25%, hero 26-51%, head from 52%, caption on the chest at 77.5%.
  (Earlier head at 0.58 put the caption on the face → moved head to 0.52 and head size to 0.18.)

### 7.5 Text rendering (Playwright, SYSTM Display V2, RTL)
- Render every title state and caption state as a transparent PNG with Chromium (Playwright), element
  screenshot with `omitBackground: true`, viewport 1080 wide, `deviceScaleFactor: 1`, wait `document.fonts.ready`.
- **Embed fonts as base64 data URLs in `@font-face`.** `file://` font URLs silently fell back to a serif.
  Weights: 900 `SYSTMDisplayV2-Black.ttf` (`format('truetype')`), 800 ExtraBold, 700 Bold, 500 Medium `.woff2`.
- CSS: container `direction:rtl;text-align:center;padding:30px 44px`.
  - title `.t`: 900, Paper, `font-size` per look (default 112 px; 128 wrapped 3-word titles onto 2 lines),
    `line-height:1.04; letter-spacing:-.01em; max-width:1040px; text-shadow:0 4px 26px rgba(0,0,0,.6)`.
  - caption `.c`: 800, Paper, 64 px, `line-height:1.1; text-shadow:0 3px 18px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.5)`.
  - kicker `.k`: 500, 48 px, Paper 80%.
  - `.ice{color:#acf4f8}`; pill: Ice background, Carbon text, 900, 108 px, radius 999, padding 8/56/14,
    `box-shadow:0 10px 40px rgba(172,244,248,.25)`.
- **Word-by-word states without jumping:** each state renders the FULL line laid out, with not-yet-said words
  `visibility:hidden` (`.ghost`). So words never shift while the line builds (critical for centered RTL).
- Accent index: exact normalized match of `accent` in the title words, else substring match.
- Caption grouping (`captionGroups`): break at punctuation, a gap > 0.35 s, 3 words, or 15 characters; strip
  trailing punctuation; accent = first word containing a plan keyword (normalized letters/digits only).
- Title state timing: each word lands when it's spoken in the beat (fuzzy normalized match, ≥2 chars,
  monotonic, ≥ +0.12 s apart), else staggered +0.22 s; clamp to `end - 0.2`.
- Caption state timing: each word at its spoken start; line ends at the next line's start or `e + 0.6`.
- Verify by compositing a few states on a dark grey sheet and reading it (font actually loaded? wraps?).
  Check all titles stay one line: flag any title PNG taller than ~260 px.

### 7.6 Blender scene (`scene.py`, Blender 5.2 LTS, headless Eevee)
Invocation: `Blender -b --factory-startup -noaudio -P scene.py -- scene.json --out DIR --pass P
[--stills f1,f2] [--start f --end f] [--save file.blend --frame f --no-render]`.
`depth.mjs` writes `scene.json` (frames, layers with resolved z/x/y/h/anim/at, title/caption states with
frames, presenter framing, matte dir/count).

Render settings:
- `BLENDER_EEVEE`, 1080x1920, `resolution_percentage` 50 for preview / 100 final, fps 30, frames 1..N.
- **View transform `Standard`, look None** (Filmic/AgX would wash out the painted images).
- `taa_render_samples` 8 preview / **12 final** (was 32: overkill since grain is added in finish).
- `bokeh_max_size` 60 / 120.
- Motion blur: `use_motion_blur`, shutter **0.6**, `motion_blur_position = 'START'`, `eevee.motion_blur_steps`
  **1** (was 3, then 2; 1 is visually almost identical and halves render time).
- `film_transparent` for front/presenter/text passes (RGBA PNG), opaque RGB for world. PNG 8-bit.
- World background near-Carbon (0.0025, 0.0037, 0.0043).
- **`preferences.edit.keyframe_new_interpolation_type = 'LINEAR'` and key every animated value on EVERY frame**
  (easing is computed in Python, so Blender must not add its own Bezier easing between keys).

Camera and layout math:
- Camera looks down -Z, `sensor_fit VERTICAL`, `sensor_height 36`, `lens 35`, clip 0.05-500.
- Half frame height at distance d: **`hh(d) = d * (36/2) / 35 = d*18/35`**. Frame width at d = `2*hh(d)*9/16`.
- Layer placement in frame units: `bx = x * hh(z) * aspect`, `by = y * hh(z)`, plane height `ph = h * 2 * hh(z)`,
  `pw = ph * image_aspect`. So apparent size is independent of depth; depth only changes parallax and DOF.
- **bg planes are oversized 1.55x** the frame at their depth (cover width too) so camera moves never show an edge.
  If an edge appears: lower the move `amount` or increase the bg `z`.
- Unit plane mesh with UVs, one copy per layer; collections `World/<beat label>`, `Front/<beat label>`,
  `Presenter`, `Text`; a timeline marker per beat (`"b3 <title>"`).

Materials:
- Emission shader (Strength = `gain`) mixed with Transparent BSDF by image alpha × Object Info alpha (object
  `color[3]` keyed for fades). Image texture `Cubic` interpolation, extension `CLIP`, `alpha_mode STRAIGHT`.
- **`surface_render_method = 'DITHERED'` for world layers** (needed for real Eevee DOF on them);
  **`'BLENDED'` for screen-locked layers** (presenter, captions, screen titles, flashes, Ice line) so their
  edges stay clean and sorted.
- Presenter: the `src.mp4` as a MOVIE image (frame_duration = N, auto refresh) for color, the matte PNG
  SEQUENCE (colorspace Non-Color) through Map Range 0.2→0.9 for alpha. A second plane plays the full video for
  `presenter: "full"` beats (slow 1.2%/s push).
- Visibility per beat: key `hide_render` and `hide_viewport` booleans (hidden at frame 1, visible at f0,
  hidden at f1+1).

Camera motion per beat (s = seconds into the beat, T = beat length, foc = focus depth, A = amount × look motion):
- push `z = -A*0.035*foc*s` (≈3.5%/s of focus distance); pull mirrored; dolly `0.07`; truck `x = ±A*0.045*foc*(s-T/2)`;
  rise/fall `y = ±A*0.035*foc*(s-T/2)`; orbit `3°*A per s` around the focus (x = sin·foc, z = foc(1-cos), ry);
  roll `z=-A*0.03*foc*s` + `2.5°*A/s` roll; static `z=-0.012*foc*s` (never fully still).
- Truck amount 0.55 worked; 1.0 pushed titles off the frame edge.

Transitions (ease_out = 1-(1-t)^3, ease_in = t^3):
- INTO `push`: `z -= 0.42*foc*(1-ease_out(u/9))` and fstop lerps toward 0.3 (lands too close and defocused,
  settles in 9 frames). OUT of a beat before `push`: last 5 frames `z -= 0.5*foc*ease_in(...)`.
- `whip-*` (DIRS: left (-1,0), right (1,0), up (0,1), down (0,-1)): out = camera moves 0.6 of frame size over the
  last 6 frames (ease-in); in = starts 0.55 frame offset and settles over 7 frames (ease-out).
- `dive`: out = last 9 frames push 0.95*foc (through the hero); in = starts 0.3*foc back, fstop → 0.4, settles in
  10 frames, plus white haze alpha [0.85,0.7,0.5,0.3,0.15,0.05] over 6 frames.
- `flash` (white) / `dip` (black): overlay alpha [1,0.75,0.4,0.15] over the first 4 frames in, 0.6 and 0.25 on
  the last 2 frames out; camera 0.25*foc settle over 8 frames with fstop → 0.35.
- `line`: an Ice plane 5 px thick, camera-parented at 1.25: grows across the full width over 8 frames
  (ease-out) before the cut, then retracts over 8 frames after (ease-in). Emission 1.6.
- Focus distance keyed per frame = `max(0.3, foc + z)`; fstop keyed per frame.

Presenter offset (`pres_off`, frame units):
- Whip into a beat when the previous beat had the presenter: offset `-dir*0.22*(1-ease_out(u/7))` (carries the
  momentum, settles in 7 frames).
- Re-entry (previous beat had no presenter, or transition push/flash/dip/dive): **rises from py -0.45** over 7 frames.
- Whip out: last 6 frames he moves `dir*0.9` with the set.

Entrances (`ENTRY` frames: pop 8, rise 7, drop 6, slide-left/right 10, flip 8, zoom 8, fade 8; alpha = clamp(u*1.8)):
- pop: scale 0.65→1 with a 6% rise, no overshoot. rise: from -0.9 heights. drop: from +1.6 heights, alpha fast.
- slide: ±1.2 widths. flip: from edge-on at 88° on Y with 0.35 width offset. zoom: 1.35→1. fade.
- Exits (`out`): 4 frames ease_in², moving 1.4 widths sideways or 1.8 heights up, alpha to 0.7.
- Float: sin bob 1.5% of height with period 3.6 s plus ±1° roll with period 4.4 s, phase from the layer id.

**fg fix:** fg layers keep their distance from the camera in depth: `zf = cam_z*0.85 - z`. Without it the
momentum push (~3 units forward) flew the camera THROUGH the fg plane at depth 3.2, which then filled the frame
and hid the presenter.

Titles:
- World titles (default): planes in the beat's World collection at depth `z` (11), sized at `hh(max(1, z - adv))`
  where `adv` = the beat's max forward camera advance from the in-beat move alone (`base_z`, excluding
  transition frames; including the dive frames made titles tiny or missing). First state: 7-frame rise 8% +
  scale 0.94→1 + fade; later states 3-frame fade. They leave with the set.
- Screen titles (`space: "screen"` or `full` beats): camera-parented at DT 1.2, BLENDED.
- Captions: camera-parented at 1.2, y from `captionY`; first word rises 6 px over 3 frames; later words appear
  in place.

Passes and compositing:
- `world` (sets + world titles, DOF, opaque), `presenter` (screen-locked, sharp), `front` (fg in front of the
  presenter, DOF, transparent), `text` (captions, screen titles, flashes, Ice line). Selected with
  `layer_collection.exclude`. This lets a foreground element pass between the presenter and the camera.
- Stills: render the requested frames for all 4 passes, stack with PIL (`alpha_composite`), tile with ffmpeg
  `xstack` 270x480 tiles, 6 columns → `stills/sheet.jpg`. Default still frame per beat: middle + min(12, len/4).

### 7.7 Viewer (`depth.mjs open`, `viewer.py`)
- Saves `scene.blend` (`--save --frame f --no-render`), then `open -na Blender --args scene.blend --python viewer.py`.
- viewer: turns the smallest non-3D area into a Timeline (Dope Sheet → TIMELINE), splits the main 3D view
  vertically (0.58): left = free oblique three-quarter view of the planes in depth (Material preview shading,
  clip_end 400, relationship lines off), right = camera view. Markers show the beats; one collection per beat
  in the Outliner. Tell Ariel "press Space to play".
- Remember the depth axis is -Z when setting the oblique view rotation/location.

### 7.8 Browser timeline board (`board.mjs` + `board.html`)
- `node engine/depth/board.mjs [--port 4466]` → http://localhost:4466: every depth project's timeline (beats,
  thumbnails, transitions, words lane, per-pass render progress bars), auto-refresh.
- RTL Hebrew, SYSTM tokens, SYSTM Display V2 fonts served locally.
- Fixes: don't refresh while a `<video>` is playing; preserve horizontal scroll of timelines on refresh; most
  recently edited plan first (sort by plan.json mtime); words lane in 2 alternating rows so words don't overlap.
- Starting a server and `open`ing in one compound command was denied by the auto-mode classifier; run the server
  as a background command, then `open` the URL separately.

### 7.9 Finish (ffmpeg)
- Inputs: 4 PNG sequences (`-framerate 30 -i frames/<pass>/%05d.png`), `src.mp4` audio, then sound files.
- Video chain: `[0]scale=1080:1920:flags=lanczos,format=rgba[w];[1]...[p];[2]...[f];[3]...lanczos[t];
  [w][p]overlay=format=auto[a];[a][f]overlay=format=auto[b];[b]<look grade>[g];[g][t]overlay=format=auto,format=yuv420p[v]`
  — **grade is applied BEFORE the text pass**, so captions/titles/Ice line stay pure brand colors.
- Encode: libx264 `-preset slow -crf 15 -maxrate 16M -bufsize 32M -profile:v high`, AAC 192k 48k, `-shortest`,
  `+faststart` (preview: veryfast, crf 21). Output `depth-vN.mp4` (or `depth-preview.mp4`).
- Final deliverable for Ariel copied to `~/Downloads/SYSTM-Depth-<name>.mp4`.

---

## 8. Sound system (bank, SFX mapping, peak alignment, ducking)

### 8.1 Bank (`~/content-os/sound/`)
- `sfx/<category>/*.wav` (48 kHz) and `music/*.wav|mp3`; `index.json` entries
  `{id, file (relative), category, tags, dur, peak_at, lufs, source, license, url}`; `LICENSES.md`;
  `preview.html` (dark page, an audio player per item); `README.md` in Hebrew.
- Categories (folder names the engine maps to): `whoosh` (6-10, 0.3-0.9 s airy, not cartoony), `swish`
  (4-6, 0.15-0.35 s), `impact` (5-8, deep tight hits, short tail), `riser` (4-6, 0.8-2 s into a hit), `subdrop`
  (3-4), `flash` (3-5, camera flash/shutter/bright transient), `pop` (6-10, soft glassy/ceramic pops, ticks),
  `text` (6-10, subtle UI ticks, typing taps), `paper` (3-5, flips/slides), `glitch` (3-5, tasteful), `ui`
  (5-8, generic message blips, NOT Apple/WhatsApp sounds), `ambience` (3-4, dark room tone 20 s+), `signature`
  (2-4). Music 8-12 tracks, instrumental, 60-120 s: dark ambient pulse, minimal tech house, cinematic tension
  build, soft piano + sub, lo-fi electronic, tasteful upbeat, glitchy hybrid; tagged with bpm and mood.
- **SYSTM sonic signature:** one distinctive 1-2.5 s sting: crystalline "ice" glass ping + soft sub swell +
  airy shimmer tail; generated/self-designed, never stock; variants: short tick for the Ice line, full sting
  for the ending.
- Sources: Suno generation (ideal for signature and music; check usage first, keep < ~60 generations),
  Kenney (CC0), Mixkit (free commercial), Sonniss GDC bundles (royalty-free), other CC0. Never CC-BY-NC Freesound,
  YouTube rips or unclear licenses; never sign up or enter credentials. ElevenLabs SFX is an option when its
  billing works (another session generated 8 SFX there and placed 11 instances).
- Treat downloaded archives as untrusted: extract into an empty temp dir, copy only audio out, run nothing.
- Processing: trim leading silence (keep transient sharp), fade tails, 48 kHz wav; SFX peaks ≈ -1 dBTP and
  consistent short-term loudness within a category; music ≈ -16 LUFS integrated; record LUFS.
  **Measure `peak_at`** (time of the main transient / max RMS window; risers = climax; whooshes = loudest point).
  Reject clipped, mostly silent, too long, lo-fi files.
- (At the time of extraction the bank folders existed but were still being filled by a background agent.)

### 8.2 Event → SFX mapping (automatic in `finish`, list written to `edit/depth/sfx.json`)
| Event | Sound | Gain |
|---|---|---|
| whip-* transition | whoosh | 0.75 |
| push transition | alternating impact (0.45) / swish (0.5) | |
| dive | riser (0.55) + impact at +0.05 s (0.5) | |
| flash | flash (0.6) + subdrop (0.45) | |
| dip | subdrop | 0.5 |
| line | signature (short) | 0.55 |
| hero enters | pop (0.45), or impact (0.35) if `drop` | |
| card enters | paper if `flip` else pop | 0.45 |
| fg enters (non-first beat) | swish | 0.25 |
| each title word | text tick | 0.2 |
| video end | longest signature sting, ending 0.2 s past the end | 0.6 |
- Layer SFX fire at entrance time + 0.08 s.
- **Peak alignment:** each sound starts at `event_time - peak_at` so its transient lands exactly on the event
  frame; sounds that would start before 0 are dropped (except at t≈0).
- Deterministic variety: seeded PRNG from `plan.seed` or the project name; never the same file twice in a row
  per category (4 tries).
- Music: `plan.music` id, else random from the bank; `plan.music: false` disables; `--no-sfx` disables all.

### 8.3 Audio graph
- Voice `[src:a] aresample=48000, asplit` → one copy to the mix, one as sidechain key.
- Music: `-stream_loop -1`, `volume=musicGain (default 0.22)`, `afade in 0.6 s`, `afade out` over the last
  1.5 s, then **`sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350`** keyed by the voice (ducking).
- Each SFX: `volume=gain, adelay=ms|ms`.
- `amix=inputs=N:normalize=0:dropout_transition=0` (normalize=0 so levels don't jump as inputs end),
  `alimiter=limit=0.95`, `atrim` to the video length.
- Target master still -14 LUFS / -1.5 dBTP for SYSTM Cut; Resolve renders measured -14.0 LUFS, -0.6 dBTP.

---

## 9. Render speed tuning (Apple M3, 10 cores, 24 GB)

- First full render: ~8 s per frame for the world pass (32 TAA samples × 3 motion-blur steps = 96 sub-renders per
  frame) → ~3.5 h for 1584 frames. Too slow.
- Step 1: samples 32→12, MB steps 3→2. Step 2: MB steps → 1.
- Step 3: **parallel chunks**: 3 Blender processes for the world pass on disjoint frame ranges + 1 process for
  the light passes (presenter, front, text), via `render --passes <list> --from <s> --to <s>` (frame f ↔ second
  (f-1)/30). Keep already-rendered frames; resume from the last complete frame (drop a possibly partial last PNG).
- Result: **12 → 25 frames/min**, GPU device utilization 65% → 81%. ~50 min for the remaining ~1300 frames;
  ~1.5 h total per 50 s reel before tuning, so a 20-reel batch ≈ 30 h of compute → run as a queue.
- Light passes are much faster than world; they ran ahead.
- Preview renders (50% res, 8 samples) are fast: first test did 7 frames in 12 s.
- Run long jobs with `run_in_background`, measure progress by counting PNGs newer than a marker file.
- Prepare other reels (init, words, matte) at low priority so they don't slow the main render.

---

## 10. Bugs, failures and fixes (chronological where useful)

Pipeline / environment:
- **ElevenLabs STT 401 `payment_issue`** (failed subscription payment) → automatic **Gemini fallback**
  (`gemini-flash-latest`, inline audio, JSON) with `approxTimes: true`; tell Ariel; verify caption timing.
- **Words dropped at cut boundaries** by the `cos.mjs cut` remap → re-transcribe the cut (`depth.mjs words`).
- **ffmpeg on this Mac has no `drawtext`** ("No such filter: 'drawtext'") → no burned labels on analysis strips
  (index file instead); never use drawtext for captions anyway (breaks RTL). Use `testsrc2` for test patterns.
- **`silencedetect` output missing** with execFileSync → `spawnSync` and parse stderr.
- **Playwright not installed globally** → load via `createRequire` from a known node_modules
  (`PLAYWRIGHT_DIR` env, or an existing project's node_modules) and pass `executablePath` of the cached
  Chromium for Testing.
- **Fonts via `file://` silently fell back to serif** → base64 data-URL `@font-face`.
- **`sleep N; check` chains are blocked** by the harness → `run_in_background` for long commands, or
  `until <condition>; do sleep 5; done` loops (Monitor).
- **`rm` of files built from shell variables was blocked** by the safety check → don't delete with variable
  paths; work around by not deleting (resume renders by frame range instead).
- **Starting a server + `open` URL in one command was denied** by the auto-mode classifier → background the
  server, then open separately.
- **Write refused because the file wasn't read first / changed since read** → Read, then Write/Edit.
- **Codex `--full-auto` flag doesn't exist** → `--skip-git-repo-check -s workspace-write`.
- **Python urllib SSL certificate error** on this Mac → use curl via subprocess (or Node fetch).
- **AnyDoc garbled Hebrew tables (reversed)** → render PDF pages to images (Swift PDFKit) and read visually.
- **Headless Claude ignores permissions in an untrusted workspace** → Ariel runs `claude` interactively once.
- **The user interrupted tool calls** several times → after each interruption, stop, report state in Hebrew,
  and check what partially ran before re-running.

Depth engine:
- **Contact sheet showed black backgrounds / fringes** around transparent objects: the sheet ignored alpha (RGB
  of transparent pixels) → composite on mid grey with PIL. (Alpha itself was fine.)
- **Backgrounds copied the anchor's composition** → no anchor for bg layers by default.
- **Presenter too small** → auto framing from mattes; then the plan's fixed `presenterScale` overrode it → removed.
- **Head width caught a raised hand** → measure only the contiguous run at top+0.06H.
- **World title tiny or missing** → title scale used the max camera advance including dive transition frames →
  use `base_z` (in-beat move only).
- **Hero covered the title; push enlarged things too much** → layout defaults (title 12-25%, hero 26-51%) and
  slower moves.
- **Caption on the face** → presenterTop 0.52, head 0.18, caption 0.775.
- **Presenter missing in a test frame**: the test clip had graphics burned in / head positioned low in that cut;
  tripod footage doesn't have this. Check `stills/presenter/*.png` bbox and alpha extrema to debug a pass.
- **fg glass/pillar covering the presenter**: the momentum push moved the camera ~3 units forward, past the fg at
  3.2 → fg keeps its distance from the camera (`zf = cam_z*0.85 - z`); fg moved out to x ±1.12, h 1.25.
- **A "glass" fg layer came back fully opaque**, covering the whole frame (Vision lift can't separate a frosted
  glass panel) → crop it to a vertical strip (~26% of width) and paint a horizontal gradient alpha
  (0 at 10% → 1 at 45% of the strip width) by hand with PIL; keep the original as `.orig.png`.
- **Titles cut off by sideways truck moves** → truck `amount` 0.55; move fg pillars to the side opposite the title.
- **Titles wrapping to 2 lines** at 128 px → default 112 px and max-width 1040 px.
- **Beat timeline:** Blender frames are 1-based: `f = round(s*30) + 1`, beat end `fr(end) - 1`.
- **Render too slow** → section 9.

Resolve / captions (other sessions, relevant when the edit is finished in DaVinci Resolve):
- Captions must be Text+/Fusion titles on a track, never rendered .mov overlays.
- `InsertFusionTitleIntoTimeline` ripples every track at the playhead → park the playhead 2 s past the end,
  insert, `SetRightOffset` to trim, `SetPosition` to move.
- Text+ has no glyph fallback; a Hebrew-only font renders Latin blank and a missing font renders blank → read
  each font's cmap and swap per caption. `FontManager.AddFont(path)` loads new fonts (ScanDir doesn't).
- Only the Black weight of SYSTM Display V2 was installed system-wide; install other weights before using them
  in Resolve.
- Text+ `Size` isn't em-based: each font is scaled so its ascender-descender box is 0.793 frame widths at size 1.0.
- Never use Fusion's Shadow tool with large softness on UHD (froze Resolve 20+ min); build shadows from
  ColorGain + Blur + Transform + Merge, test on an HD scratch timeline.
- Text+ gradient fill: `Type1 = 2`, `ShadingGradient1`, `ShadingMappingLevel1 = 1` (maps over the text), runs bottom-to-top.
- Load node graphs with `TimelineItem.ImportFusionComp(path)`; link MediaOut to the inner tool, not a group output.
- `StartRendering` refused in a fresh session until the Deliver page was opened; the first audio render of a
  project is refused, rerun the whole export once; verify `SetCurrentTimecode` with `GetCurrentTimecode`.
- Work in a scratch project, never in Ariel's open project; `resolve.Quit()` can be refused, don't force-kill.
- Removing the caption outline in Resolve and using a soft strong shadow kept readability on light backgrounds;
  fully removing outline+shadow (as he asked) is still readable but weaker on very light frames; offer a subtle
  translucent backing instead of an outline if needed.
- A Resolve music edit: mute clip audio, generate SFX, measure lip movement vs lyrics shot by shot and shift
  singing shots (residual drift < 0.15 s), keep each 30 s window the same length; end card with logo (black logo
  on a cream background because white vanished), all end-card text visible > 2 s.

---

## 11. Reporting and verification habits that worked

- Look at every intermediate image yourself (Read the jpg): layers sheet, stills sheet, 18-frame sheet of the
  render. Measurements alone hid broken layouts several times.
- After a render: confirm the file decodes to the end, check frame count / duration / resolution / loudness, and
  say honestly what was not checked (e.g. "I didn't listen to it").
- Status updates in Hebrew, short, with what's running, progress (frames done / total, ETA), and where to watch
  (Blender window, browser board).
- When the user re-sends the same file, verify with a checksum and say it's identical.
- Ask nothing that blocks; pick a reasonable interpretation, flag it, keep going.
- Keep an ordered queue file (`QUEUE.md`) for multi-step requests; at the time: depth edits for 20 HeyGen
  doppel reels (each a different look), then the end-to-end editing plugin, then a desktop editor app.
- HeyGen raw reels: `HEYGEN_API_KEY`, `GET /v1/video.list?limit=100` with pagination token, then
  `/v1/video_status.get?video_id=` for the download URL; filter `status == completed` and the real reel titles
  (skip avatar tests, drafts, failures).

---

## 12. Quick-reference numbers

| Item | Value |
|---|---|
| Frame | 1080x1920, 30 fps, Blender frames 1-based |
| Camera | lens 35, vertical sensor 36, hh(d) = d*18/35 |
| Depths | bg 30, mid 16, title 11, hero 7, card 6, fg 3.2; presenter plane 1.6; text 1.2; flash 1.1; line 1.25 |
| bg oversize | 1.55x frame at its depth |
| Layout (from top) | title 0.10-0.14 (look), hero center y 0.22-0.24 h 0.22-0.28 (solo h 0.4), head top 0.52, head width 0.18W, caption 0.775 |
| Drift | push 3.5%/s of focus, dolly 7%, truck 4.5%, rise 3.5%, orbit 3°/s, roll 2.5°/s, static 1.2% |
| Push transition | out: 5 frames ease-in 0.5*foc; in: lands 0.42*foc closer at f/0.3, settles 9 frames |
| Whip | out 6 frames, 0.6 frame size; in starts 0.55 offset, settles 7 frames; presenter 0.22 offset, 7 frames |
| Dive | out 9 frames 0.95*foc; in 10 frames, white haze 6 frames |
| Flash/dip | 4 frames in [1, .75, .4, .15], 2 frames out [.6, .25] |
| Ice line | 5 px, grows 8 frames, retracts 8 frames |
| Entries | pop 8 (0.65→1, no overshoot), rise 7, drop 6, slide 10, flip 8 (from 88°), zoom 8, fade 8; exits 4 |
| Presenter re-entry | rises from -0.45 frame over 7 frames |
| Title states | first 7-frame rise+fade, then 3-frame fades; 112 px default |
| Caption | SYSTM Display V2 800, 64 px, ≤3 words / 15 chars, break on gap > 0.35 s, y 0.775 |
| Rhythm | beat 1.2-6 s (scene every 2.8-4 s), visual event every 1-1.5 s |
| Eevee final | 12 samples, MB shutter 0.6, 1 MB step, Standard view transform |
| Grade | curves with lifted blacks (0.02-0.045), whites 0.95-0.96, vignette 0.42, noise 5 |
| Audio | music gain 0.22 + sidechain (thr 0.03, ratio 6, 15/350 ms), SFX at peak_at, limiter 0.95, master -14 LUFS / -1.5 dBTP |
| SYSTM Cut | silences > 0.45 s, 2-4 frames head / 4-6 tail, zoom 100/112/125, captions 76-92 px at 64-70%, change every ≤ 8 s |
| Output | H.264 High, 12-16 Mbit (crf 15, maxrate 16M), AAC 192k 48 kHz, faststart |
| Seedance | always 30 s, 480p |
