import { useEffect, useState } from 'react';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Optional photoreal Arya. Drop a rigged avatar at public/models/arya.glb (or point
// NEXT_PUBLIC_ARYA_MODEL_URL somewhere else) and she is used automatically; with no
// file — or if it fails to load — the built-in procedural Arya stays. See
// docs/ARYA_PHOTOREAL_AVATAR.md for how to produce a compatible file.

export const ARYA_MODEL_URL = process.env.NEXT_PUBLIC_ARYA_MODEL_URL || '/models/arya.glb';

export type AryaModel =
  | { status: 'loading' | 'none' }
  | { status: 'ready'; gltf: GLTF };

let pending: Promise<GLTF | null> | null = null;

/** Looks for the file, then loads it. Memoised: the 3D scene can remount without refetching. */
function loadAryaModel(url: string): Promise<GLTF | null> {
  pending ??= (async () => {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const type = head.headers.get('content-type') ?? '';
      if (!head.ok || type.includes('text/html')) return null; // no file there (Next serves its 404 page as HTML)

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      return await loader.loadAsync(url);
    } catch (error) {
      console.warn('[arya] photoreal model unavailable, using the built-in avatar:', error);
      return null;
    }
  })();
  return pending;
}

export function useAryaModel(url: string = ARYA_MODEL_URL): AryaModel {
  const [model, setModel] = useState<AryaModel>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    void loadAryaModel(url).then((gltf) => {
      if (alive) setModel(gltf ? { status: 'ready', gltf } : { status: 'none' });
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return model;
}
