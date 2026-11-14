---
name: systm-video-editing
description: The end-to-end SYSTM video editing playbook. Routes between talking-head editing (SYSTM Cut: rough cut, captions, cards, grade, sound) and SYSTM Depth (image layers in 3D in Blender, painted with Codex image_gen), and holds every rule, number and fix learned while building them. Use when asked to edit a reel, "תערוך לי סרטון", "עריכה בסגנון SYSTM", "עריכת עומק", "depth edit", "captions", "rough cut", or when you need the house rules for video.
---

# SYSTM video editing

Read first: `../../references/playbook.md` (everything learned, with numbers and fixes). Then the reference for the mode you are in.

## Which mode
- **SYSTM Cut** (talking head, captions, cards): skill `content-edit`, reference `../../references/video-style.md`, lessons `../../references/lessons-edit.md`.
- **SYSTM Depth** (3D world made of image layers): skill `systm-depth` (router) → `systm-depth-plan` → `systm-depth-layers` → `systm-depth-render`. References `../../references/depth.md` (the plan.json contract) and `../../references/motion-grammar.md` (frame-by-frame findings).

## Rules that never change
- Never publish or schedule. The work stops at a version for review; the person approves.
- The video font is the brand's own display face (SYSTM Display V2; not included in this repo, bring your own font). Ice `#acf4f8` is the only accent color.
- Each video gets a different `look` (`engine/depth/style.json`), and every video keeps the signature marks (`signature` in the same file).
- Grade like a film frame, not like bright stock.
- Look at the frames before showing anything: stills sheet, contact sheet, Blender (`depth.mjs open`) or the browser board (`engine/depth/board.mjs`).

## The engine
- `engine/cos.mjs` (cut pipeline).
- `engine/depth/` (`depth.mjs` CLI, `scene.py` Blender builder, `matte.swift` Apple Vision matting, `viewer.py`, `board.mjs`, `style.json`).

Paths assume the engine lives at `~/content-os/engine/`; adjust `ROOT` if not. Requirements: macOS (Vision), Blender 5.x, ffmpeg, Node 20+, Python 3 with Pillow, Playwright Chromium, Codex CLI logged in (for image_gen).
