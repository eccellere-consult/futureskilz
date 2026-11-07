# Arya's picture

`arya.webp` (light, loaded first), `arya.png` (the full-size original) and `arya-teeth.png` (her real teeth, painted inside the
mouth when she speaks) bring Arya to life in the browser: she blinks, speaks with her mouth and teeth, smiles, looks around and sways.

**The animation is tied to this exact photograph.** The positions of the pupils, mouth corners, ears and jhumkas are pixel
measurements of the 1254 x 1254 picture, set in `src/features/arya/engine/arya-photo-figure.tsx`. Replacing the picture means
re-measuring them. See `docs/arya/avatar-modes.md` for the details, and `docs/arya/image-spec.md` for how to brief a new picture.

For a fully 3D character, place a rigged glTF at `public/models/arya.glb` (ARKit blendshapes); it takes priority over the photo.
Only use a picture you have the right to use, and keep her labelled as an AI.
