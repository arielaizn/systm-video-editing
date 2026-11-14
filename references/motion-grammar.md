# Motion grammar: what the frame-by-frame analysis showed

Source: 7 reference reels built from image pieces in 3D space (Blender + an image model, no video model). Each reel was split into frames at 30fps. 61 strips of 16 consecutive frames were studied: scene cuts, motion energy per frame and events. The numbers below are what the engine implements (`engine/depth/scene.py`); the plan only chooses.

## 1. The camera never stops
- Inside every beat there is a **linear** drift of 2–5% of the frame per second, up to 25% for emphasis. No easing in the middle of a beat: easing belongs only to transitions.
- Almost every beat has a near, blurred element at the frame edge (`fg`). It creates the strongest parallax, 2–3 times the background.
- Moves: `push` / `pull` (z), `truck-left/right` (x), `rise` / `fall` (y), `orbit` (3°/s), `dolly` (twice a push), `static` (almost: -0.012).

## 2. Few hard cuts, and every cut carries momentum
**push** (the go-to transition):
- Out: the outgoing beat accelerates inward (ease-in) about 1→2x over the last 5 frames.
- In: the new beat lands 1.6–2.2x too close and out of focus (fstop ~0.3), then eases out back to normal over 6–9 frames with a rack focus.

**whip** (`whip-left/right/up/down`):
- 4–9 frames, 3–5 of them blurred.
- The camera moves 0.6 of the frame over 6 frames on the way out.
- The new set comes in from the opposite side, 0.55 off, and decelerates over 7 frames.
- A foreground element moves 2–3 times faster and covers 40–55% of the frame during the whip.
- The presenter carries the momentum: he arrives offset about 0.2W in the whip direction and settles in about 6 frames.

**The rest:**
- `dive`: through the previous hero, with a white haze of 6 frames (0.85→0.05).
- `flash`: white for 1–4 frames (1, 0.75, 0.4, 0.15).
- `dip`: the same to black.
- `line`: a thin Ice line across the frame (the SYSTM signature).
- `cut`: only for the first frame.

## 3. Entrances and exits
- `pop`: from 65% scale with blur, a 3–5% rise, 6–8 frames, ease-out **with no overshoot**.
- About 2 frames of stagger between objects in the same beat.
- `drop`: 2–6 frames with a ghost blur.
- `flip`: from edge-on (88°).
- `slide-left` / `slide-right`: 10 frames.
- Exit: 4 frames with ease-in (up, or to the side).
- Presenter re-entry: rises from the bottom (py -0.45) over about 6 frames.

## 4. Titles
- Top band, 0.12–0.25H, 1–3 words (4 at most).
- Builds **word by word on the speech**: each word lands when it is said, 1–2 frames from ghost to solid.
- Rendered as one line with the unsaid words hidden, so no word jumps while the line builds (RTL, centered).
- Mostly part of the scene, at depth 11 behind the hero: it leaves with the set in a transition, and objects can partly cover it. This is the trick that sells the depth.

## 5. Captions
- Small (2.5–4% H, about 64px at 1080x1920), locked to the screen, built word by word, at about 0.775H (on the chest, not the mouth).
- 3 words / 15 characters at most per line; break on a gap > 0.35s.

## 6. The presenter
- Head width 0.17–0.23W; top of the head at 0.52–0.68H. In the engine: `presenterHead` 0.18, `presenterTop` 0.52, measured automatically from the mattes.
- Absent 35–50% of the time in the references; in ours, 3–4 `none` beats and one `full`.
- Sandwiched between depth layers: world → presenter → foreground → text.

## 7. Rhythm
- A new scene every 2.8–4s.
- A visual event (entrance, transition, word) every 1–1.5s.
- No beat longer than 6s; something always moves.
