# Arya's face: photo, photoreal 3D file, or built-in

Arya picks the best face available, in this order:

1. **Photoreal 3D file** — `public/models/arya.glb` (see below).
2. **Photo** — `public/avatars/arya.webp`, else `public/avatars/arya.png` (current default).
3. **Built-in** procedural 3D avatar.

## The photo avatar

The photo is warped and painted in real time (`components/arya/arya-photo-figure.tsx`): she blinks
(skin is painted over the eyes), speaks (jaw and lips open, the inside of the mouth is painted),
smiles, raises her brows, looks aside, sways her head with parallax, breathes, and her jhumkas swing.

- `arya.webp` is a light copy (~200 KB) of `arya.png` (2.2 MB) that loads first — regenerate it if
  you replace the PNG: `python3 -c "from PIL import Image; Image.open('public/avatars/arya.png').convert('RGB').save('public/avatars/arya.webp','WEBP',quality=90,method=6)"`.
- **The animation is tied to this exact photo.** Eye, mouth, ear and jhumka positions are pixel
  measurements of the 1254 × 1254 image, hard-coded in the shaders in `arya-photo-figure.tsx`
  (pupils (530,442) and (718,452); mouth corners (527,626) and (700,636); jhumka hooks (397,607)
  and (824,603); head tilt ≈ 3–4°). **A different photo needs these re-measured.**
- **Teeth:** `public/avatars/arya-teeth.png` is her real teeth, cut from a second photo of the same
  person smiling and straightened (`python3 scripts/arya-teeth-from-photo.py smiling.jpg`). The mouth shader
  paints it inside the opening; without the file it falls back to procedurally drawn teeth. Use only photos
  you have the rights to.
- **Mouth opening is capped** (`uOpen` ≤ 0.55 in `arya-photo-figure.tsx`) so conversation never looks wide-mouthed;
  raise the `0.55` there if you want more. Lower teeth are her upper teeth mirrored (smaller, same colour) along the bottom of the opening — the photo's real
  lower teeth are a few blurred pixels fused with the lip and cannot be cut out.
- Limits: a still photo has no inside to its mouth, so the opening is painted; it reads well at the
  sizes used on screen but is not a video-grade face. Large head turns are limited to a few degrees.

# Photoreal 3D avatar file (optional)

Arya ships with a built-in procedural 3D avatar. To give her a photoreal face, add a rigged
avatar file. The app picks it up automatically — no code change:

1. Put the file at **`public/models/arya.glb`** (or host it elsewhere and set
   `NEXT_PUBLIC_ARYA_MODEL_URL`).
2. Redeploy. While it loads (and if it is missing or fails to load) the built-in Arya shows.

Her greeting, voice, lip-sync, blinking, gaze, head movement and expressions all work on the
new model through the standard face blendshapes below.

## What the file needs

| Item | Requirement |
|---|---|
| Format | glTF 2.0 binary (`.glb`). Meshopt compression is supported; **Draco is not**. |
| Size | Aim for **under 8 MB** (2K WebP/JPEG textures). Large files are slow on budget Android phones. |
| Facing | Faces +Z (the glTF default). Head and shoulders is enough; full body also works. |
| Face blendshapes | ARKit names, on the head mesh: `jawOpen`, `eyeBlinkLeft`, `eyeBlinkRight`, `mouthSmileLeft`, `mouthSmileRight`, `mouthFunnel`, `mouthPucker`, `mouthStretchLeft`, `mouthStretchRight`, `cheekSquintLeft`, `cheekSquintRight`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`. |
| Optional | Visemes `viseme_aa`, `viseme_O`, `viseme_E`, `viseme_I` (better lip-sync). `eyeSquint*`. |
| Eyes | Bones named `LeftEye` / `RightEye` (used to scale and place the model and to move the gaze). Without them the `eyeLook*` blendshapes are used and the model is sized from its bounding box, which is less precise. |
| Head | Bones named `Head` and `Neck` for head movement. |

Any tool that exports an ARKit-blendshape avatar works (for example Avaturn, Reallusion Character
Creator, or a MetaHuman exported through Blender). Check each tool's current licence for
commercial use in an app.

## Prepare and shrink it

```bash
npx @gltf-transform/cli optimize raw.glb public/models/arya.glb \
  --compress meshopt --texture-compress webp --texture-size 2048
```

If the file is more than a few MB, keep it out of normal git history (Git LFS), or host it on the
R2 bucket and set `NEXT_PUBLIC_ARYA_MODEL_URL` to its URL.

## Likeness and consent

If the avatar is built from a photograph of a real person, get that person's written consent
for this use. If it is built from an AI-generated reference image, confirm you hold the rights
to use that image and the resulting avatar commercially.

## Checking it works

Open an elder page and tap Arya. She should greet, blink, and move her mouth while speaking.
In the browser console, `[arya] photoreal model unavailable…` means the file was missing or
invalid and the built-in Arya is being used instead. Test on a mid-range Android phone before
rolling out; if it stutters, reduce texture size or mesh detail.
