# Arya's portrait: exact specification

Use this to generate (or brief a photographer or designer for) a picture that the live avatar can animate without any
misalignment. The animation moves the mouth and eyelids at fixed positions, so **where the face sits in the picture matters
more than anything else**. `alignment-guide.png` (same folder) shows every target point; give it to the image tool as a layout
reference, or lay it over the result to check.

## Technical
- **Size:** 2048 x 2048 px, square. PNG or high-quality JPG. Save as `public/avatars/arya.png` (or `.jpg`).
- **Content:** one woman, head and shoulders, nothing else. **No text, logos, cards, captions, UI or watermarks anywhere.**
- **Background:** softly blurred, plain and warm (off-white, or a soft deep purple). No objects near the face.

## Pose and framing (all positions are fractions of the width / height, from the top-left)
| Feature | Position |
|---|---|
| Face centre line (nose bridge, bindi, chin) | x = 0.50 exactly: face centred, head turned no more than 3 degrees |
| Head tilt | **0 degrees**: the line through both pupils is horizontal (y difference under 0.005) |
| Left pupil / right pupil | (0.42, 0.36) and (0.58, 0.36): distance between pupils 0.16 of the width |
| Bindi | (0.50, 0.31) |
| Nose tip | (0.50, 0.46) |
| **Mouth: where the lips meet** | **(0.50, 0.55)**, mouth corner to corner 0.14 wide (x 0.43 to 0.57) |
| Chin (lowest point) | y = 0.68 |
| Top of hair | y about 0.12 |
| Cheek to cheek (face width) | x 0.33 to 0.67 |
| Ears with jhumka earrings | centres about (0.28, 0.52) and (0.72, 0.52), both visible |
| Shoulders and neckline | shoulders reach x 0.12 to 0.88 at y 0.85, picture ends at the chest |

## The face (matters for the animation)
- **Looking straight into the camera**, eyes fully open and relaxed, not squinting; full iris visible; natural lashes.
- **Mouth closed in a gentle, relaxed smile with the lips together and teeth NOT showing.** The animation opens the mouth with
  her voice; it cannot invent teeth or a mouth interior, so a closed mouth gives the most natural result. (A smile with visible
  teeth makes the opening look wrong.)
- Even, soft front lighting. No hard shadow across the eyes, nose or mouth. No hair across the eyes, mouth or chin: hair swept
  behind the shoulders and ears.
- Neutral, kind, professional expression.

## Ready-to-paste image prompt
> Photorealistic studio portrait, square 2048x2048, of a poised Indian woman in her early thirties, long dark brown hair worn
> behind her shoulders, wearing a white linen kurta with fine blue floral embroidery, a delicate silver necklace, small black
> bindi, silver jhumka earrings. Head and shoulders, shot at eye level on an 85mm lens, soft even front lighting, softly blurred
> plain warm off-white background. She looks straight into the camera with a calm, kind, relaxed expression and a gentle closed-lip
> smile, teeth not showing, eyes fully open. Her head is perfectly upright and centred: face turned toward the camera by no more
> than 3 degrees, no head tilt, pupils on one exact horizontal line at 36% of the picture height, 42% and 58% across, nose tip at
> 46% height, lips meeting at 55% height exactly on the vertical centre line, chin at 68% height, top of hair at 12% height,
> ears and earrings visible at 28% and 72% across. No text, logos, captions, cards, UI, watermark or props anywhere in the image.

**Negative prompt (if the tool supports one):** text, letters, logo, watermark, cards, interface, head tilt, turned head, open
mouth, visible teeth, hair across face, hands near face, sunglasses, extra people, busy background.

## After generating
1. Save it as `public/avatars/arya.png` (replace the current file) and commit.
2. Put `public/avatars/arya.json` next to it with these values (they match the table above):
```json
{ "mouth": [0.5, 0.55], "mouthRadius": [0.05, 0.03], "eyes": [[0.42, 0.36], [0.58, 0.36]], "eyeRadius": [0.04, 0.016], "focus": [0.5, 0.5], "width": 1 }
```
3. If the tool could not hit the positions exactly, upload the picture and the feature positions can be re-measured and the
   numbers above adjusted; the animation then lines up regardless.
