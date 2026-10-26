#!/usr/bin/env python3
"""Cuts a person's real teeth out of a smiling photo and saves public/avatars/arya-teeth.png,
the strip the photo avatar paints inside her mouth when it opens (see arya-photo-figure.tsx).

Usage:  python3 scripts/arya-teeth-from-photo.py smiling.jpg [--angle 16.1] [--center 650,400]
                [--window 593,396,708,418]

The photo must show the SAME person smiling with teeth. --angle is how many degrees the line of the
teeth slopes downward to the right (the photo is rotated counter-clockwise by it to level the smile);
--window is the box (x0,y0,x1,y1, in the levelled photo's pixels) from the mouth's left corner to its
right corner and from the upper lip's edge to the lower lip's edge. Defaults are for the reference
photo used for Arya. Needs: pip install pillow numpy.  Only use photos you have the rights to.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter

p = argparse.ArgumentParser()
p.add_argument('photo')
p.add_argument('--angle', type=float, default=16.1)
p.add_argument('--center', default='650,400')
p.add_argument('--window', default='593,396,708,418')
p.add_argument('--out', default='public/avatars/arya-teeth.png')
a = p.parse_args()

cx, cy = map(float, a.center.split(','))
x0, y0, x1, y1 = map(float, a.window.split(','))
up = 3

img = Image.open(a.photo).convert('RGB').rotate(a.angle, center=(cx, cy), resample=Image.BICUBIC)
win = img.resize((img.width * up, img.height * up), Image.BICUBIC).crop(
    (int(x0 * up), int(y0 * up), int(x1 * up), int(y1 * up)))
px = np.asarray(win).astype(np.float32)
R, G = px[..., 0], px[..., 1]
sat = (px.max(2) - px.min(2)) / np.maximum(px.max(2), 1)
luma = 0.299 * R + 0.587 * G + 0.114 * px[..., 2]

teeth = (sat < 0.40) & (luma > 112)       # bright, unsaturated pixels are teeth
lip = (R > G * 1.45) & (sat > 0.45)       # reddish pixels are lip or lip shadow
mask = Image.fromarray(((teeth & ~lip) * 255).astype(np.uint8))
mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.4))
m = np.asarray(mask).astype(np.float32)[..., None] / 255.0

cavity = np.array([26, 7, 9], np.float32)  # everything that is not a tooth becomes the dark of the mouth
out = px * m + cavity * (1 - m)
u = np.linspace(0, 1, out.shape[1])[None, :, None]
edge = np.clip(np.minimum(u, 1 - u) / 0.06, 0, 1)  # fade to dark at the mouth's corners
out = out * edge + cavity * (1 - edge)

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((256, 96), Image.LANCZOS).save(a.out, optimize=True)
print('wrote', a.out)
