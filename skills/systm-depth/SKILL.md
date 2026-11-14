---
name: systm-depth
description: עריכת "עומק" בסגנון SYSTM: הסרטון נבנה מחתיכות תמונה שמונחות במרחב תלת־ממדי ב-Blender, עם מצלמה שנוסעת ביניהן, הדובר גזור בתחתית, כותרות בעומק וכתוביות SYSTM Display V2. השכבות מצוירות ב-Codex (image_gen), בלי מודל וידאו. הפעל כש"תעשה עריכת עומק", "עריכה תלת מימדית", "כמו הסרטונים של בלנדר", "שכבות במרחב", "depth edit", "parallax edit", "SYSTM Depth", או כשאריאל מבקש את הסגנון של הרילס עם האובייקטים שמרחפים. זה סקיל האב: הוא מנתב לתכנון, לשכבות ולרינדור.
---

# SYSTM Depth

קרא קודם: `../../references/depth.md` (הטכניקה, שפת SYSTM והחוזה של `plan.json`), `~/content-os/brand/video-style.md`, `~/content-os/knowledge/lessons/edit.md` ו-`~/content-os/knowledge/lessons/depth.md` אם קיים. לקח כתוב גובר על ברירת המחדל.

המנוע: `node ~/content-os/engine/depth/depth.mjs <command> <project>`. כל הקבצים ב-`projects/<id>/edit/depth/`.

## הסדר
1. **מקור**: פרויקט שעבר `cos.mjs transcribe` ו-`cos.mjs cut` (יש `edit/rough.mp4` ו-`edit/words.json`). אם אין חיתוך, עובדים על הגלם (`init` לוקח אותו). מצלמה ששמרה את הווידאו על הצד: `init --rotate ccw` (או `cw`).
2. `depth.mjs init <id>`: יוצר `src.mp4` (1080x1920@30), `words.json`, `transcript.txt` ושלד `plan.json`.
3. `depth.mjs matte <id>`: גוזר את הדובר (Apple Vision, על המק). רץ ברקע בזמן שמתכננים. `--fast` לטיוטה.
4. **תכנון**: סקיל `systm-depth-plan`. כותבים `plan.json`, ו-`depth.mjs check <id>` עד שאין שגיאות.
5. **שכבות**: סקיל `systm-depth-layers`. `depth.mjs layers <id>`, ואז מסתכלים על `layers/sheet.jpg` ומתקנים.
6. **רינדור**: סקיל `systm-depth-render`. `text`, `stills` (פריים מכל פעימה, לבדיקה), `render --preview`, `finish --preview`, ואז הסופי.
7. **רישום**: `node engine/cos.mjs version <id> edit/depth/depth-vN.mp4`. משם זה חדר ההערות הרגיל של Content OS.

## כללים
- אסור לפרסם או לתזמן. העבודה נעצרת בגרסה לסקירה, אריאל מאשר ב-Studio.
- עולם אחד לסרטון. לא מחליפים פלטה באמצע.
- Ice הוא צבע הדגש היחיד, בכל שכבה, כותרת וכתובית.
- כל פעימה עד 6 שניות, משהו זז או משתנה תמיד.
- לא מבזבזים ציורים: `reuse` לרקע שחוזר, `--only`/`--redo` לתיקון שכבה אחת.
- כל תיקון של אריאל שמלמד כלל כללי נכתב ל-`knowledge/lessons/depth.md` (סקיל `content-learn`).
