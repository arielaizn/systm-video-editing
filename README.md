# SYSTM Video Editing

A full Claude Code plugin (it works with Codex too) for editing short videos end to end, in the SYSTM style. It sums up everything learned while building SYSTM's editing system: rules, numbers, mistakes and their fixes, and the working engine itself.

## What's inside

| Part | Path | What it does |
|---|---|---|
| Main playbook | `references/playbook.md` | Every insight, rule, number and fix, in one place. **Start here.** |
| Motion grammar | `references/motion-grammar.md` | What the frame-by-frame analysis of 3D reference reels showed: transitions with frame counts, entrances, titles, rhythm. |
| SYSTM Depth contract | `references/depth.md` | The `plan.json` structure, beats, layers, looks and sound. |
| Talking-head editing style | `references/video-style.md`, `references/lessons-edit.md` | SYSTM Cut: cutting, captions, cards, color, sound. |
| Skills | `skills/` | `systm-video-editing` (router), `content-edit`, `systm-depth`, `systm-depth-plan`, `systm-depth-layers`, `systm-depth-render`. |
| Engine | `engine/` | `cos.mjs` (cutting), `depth/` (Blender, Apple Vision, Codex, ffmpeg, browser timeline). |

## The SYSTM Depth technique in short
The video is built from **image pieces placed in 3D space**, with no video model:
1. **Layers:** Codex (`image_gen`) paints the layers (background, hero object, cards, foreground elements), with a single style anchor for the whole video.
2. **Presenter:** Apple Vision cuts the presenter out frame by frame.
3. **Text:** titles and captions are rendered word by word in the brand font, RTL.
4. **Blender assembly:**
   - A camera that never stops.
   - Transitions with momentum: push, whip, dive, flash and the Ice line.
   - Real depth of field and motion blur.
   - 4 separate render passes.
5. **Finish:** ffmpeg composites, grades, and adds SFX from a sound bank, aligned to each event's peak, with a music bed that ducks under the voice.

Each video gets a different look (8 looks), with fixed signature marks: the font, Ice as the only accent, the line transition, a sound signature and a signature object.

## Installation
```bash
# as a plugin marketplace in Claude Code
/plugin marketplace add arielaizn/systm-video-editing
/plugin install systm-video-editing@systm-video-editing
```
Engine: copy `engine/` to `~/content-os/engine/` (or change `ROOT`).

**Requirements:**
- macOS
- Blender 5.x
- ffmpeg
- Node 20+
- Python 3 + Pillow
- Playwright Chromium
- Codex CLI with a ChatGPT login

To compile the cutout tool:
```bash
swiftc -O engine/depth/matte.swift -o engine/depth/matte
```

## What's not included
The SYSTM brand assets: the SYSTM Display V2 font, the logo and the sound signature. Also not included: the footage, and frames from the reference reels. Bring your own font and assets.

## License
MIT for the code and documents. The SYSTM brand assets are not part of the license.
