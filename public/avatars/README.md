# Arya's picture

Put Arya's portrait here as `arya.jpg` (or `.png` / `.webp`). The site then shows her as this picture, brought to life in the
browser: breathing, blinking, and her mouth opening with her voice.

If the face sits somewhere other than in the reference portrait, add `arya.json` next to it (fractions of the picture, from the top-left):

```json
{ "mouth": [0.45, 0.338], "mouthRadius": [0.05, 0.03], "eyes": [[0.428, 0.225], [0.526, 0.234]], "eyeRadius": [0.03, 0.013], "focus": [0.42, 0.33], "width": 0.58 }
```

For a fully 3D character instead, place `arya.glb` (glTF with ARKit or Ready Player Me blendshapes). A model beats the picture, and the picture beats the built-in figure.

Only use a picture you have the right to use, and keep her labelled as an AI.
