import { useEffect, useState } from 'react';
import * as THREE from 'three';

// Arya from a photograph. public/avatars/arya.webp (a light copy, tried first) or
// arya.png is warped and painted to blink, speak and sway — see arya-photo-figure.tsx.
// With no photo, the next choices are a photoreal GLB or the built-in procedural Arya.

export const ARYA_PHOTO_URLS = process.env.NEXT_PUBLIC_ARYA_PHOTO_URL
  ? [process.env.NEXT_PUBLIC_ARYA_PHOTO_URL]
  : ['/avatars/arya.webp', '/avatars/arya.png'];

/** Her real teeth, cut from a photo and straightened (see docs/ARYA_PHOTOREAL_AVATAR.md). Optional:
 *  without it the mouth falls back to procedurally drawn teeth. */
export const ARYA_TEETH_URL = '/avatars/arya-teeth.png';

export type AryaPhoto =
  | { status: 'loading' | 'none' }
  | { status: 'ready'; texture: THREE.Texture; teeth: THREE.Texture | null };

let pending: Promise<{ texture: THREE.Texture; teeth: THREE.Texture | null } | null> | null = null;

function loadAryaPhoto() {
  pending ??= (async () => {
    const loader = new THREE.TextureLoader();
    const teethPromise = loader.loadAsync(ARYA_TEETH_URL).then(
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        return t;
      },
      () => null,
    );
    for (const url of ARYA_PHOTO_URLS) {
      try {
        const texture = await loader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return { texture, teeth: await teethPromise };
      } catch {
        // try the next candidate
      }
    }
    return null;
  })();
  return pending;
}

export function useAryaPhoto(): AryaPhoto {
  const [photo, setPhoto] = useState<AryaPhoto>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    void loadAryaPhoto().then((loaded) => {
      if (alive) setPhoto(loaded ? { status: 'ready', ...loaded } : { status: 'none' });
    });
    return () => {
      alive = false;
    };
  }, []);
  return photo;
}
