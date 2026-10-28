/**
 * SKP RENDER PRO IA - Panorama 360 Utilities
 * Helper functions for cubemap to equirectangular conversion and 360 processing.
 */

export interface CubemapFaces {
  right: string;  // px
  left: string;   // nx
  top: string;    // py
  bottom: string; // ny
  back: string;   // pz
  front: string;  // nz
}

/**
 * Stitches 6 cubemap faces into a single Equirectangular (360) panorama.
 */
export async function stitchCubemapToEquirectangular(
  faces: CubemapFaces,
  width: number = 8000,
  height: number = 4000
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('Failed to get 2D context');

      const images: { [key: string]: HTMLImageElement } = {};
      let loadedCount = 0;
      const faceKeys = Object.keys(faces) as Array<keyof CubemapFaces>;

      faceKeys.forEach(face => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          images[face] = img;
          loadedCount++;
          if (loadedCount === 6) {
            renderPanorama(images, canvas, ctx).then(resolve).catch(reject);
          }
        };
        img.onerror = () => reject(`Failed to load face: ${face}`);
        img.src = (faces as any)[face];
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function renderPanorama(
  images: { [key: string]: HTMLImageElement },
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<string> {
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Face size assumes square faces
  const faceSize = images.front.width;
  
  // Pre-load pixel data for all 6 faces:
  // front, back, right, left, top, bottom
  const faceData: Record<keyof CubemapFaces, Uint8ClampedArray> = {
    front: new Uint8ClampedArray(),
    back: new Uint8ClampedArray(),
    right: new Uint8ClampedArray(),
    left: new Uint8ClampedArray(),
    top: new Uint8ClampedArray(),
    bottom: new Uint8ClampedArray(),
  };

  const faceKeys: Array<keyof CubemapFaces> = ['front', 'back', 'right', 'left', 'top', 'bottom'];
  for (const face of faceKeys) {
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = faceSize;
    faceCanvas.height = faceSize;
    const fctx = faceCanvas.getContext('2d');
    fctx?.drawImage(images[face], 0, 0);
    faceData[face] = fctx?.getImageData(0, 0, faceSize, faceSize).data || new Uint8ClampedArray();
  }

  // Precompute horizontal angles (trigonometry optimization)
  const sinThetas = new Float32Array(width);
  const cosThetas = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const uPano = (x + 0.5) / width;
    const theta = (uPano - 0.5) * (Math.PI * 2); // -PI (back) to 0 (front) to +PI (back)
    sinThetas[x] = Math.sin(theta);
    cosThetas[x] = Math.cos(theta);
  }

  // Equirectangular to Cubemap projection
  // Coordinates in camera space:
  // Z = Forward / Front (+Z)
  // X = Right (+X), Left (-X)
  // Y = Up (+Y), Down (-Y)
  for (let y = 0; y < height; y++) {
    const vPano = (y + 0.5) / height; // 0 (top/zenith) to 1 (bottom/nadir)
    const phi = (0.5 - vPano) * Math.PI; // +PI/2 (top) to -PI/2 (bottom)
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    let rowIdx = y * width * 4;

    for (let x = 0; x < width; x++) {
      const rx = cosPhi * sinThetas[x];
      const ry = sinPhi;
      const rz = cosPhi * cosThetas[x];

      const ax = Math.abs(rx);
      const ay = Math.abs(ry);
      const az = Math.abs(rz);

      let fKey: keyof CubemapFaces;
      let u = 0.5;
      let v = 0.5;

      if (az >= ax && az >= ay) {
        if (rz > 0) {
          fKey = 'front';
          u = (rx / rz + 1) * 0.5;
          v = (-ry / rz + 1) * 0.5;
        } else {
          fKey = 'back';
          u = (rx / rz + 1) * 0.5;
          v = (ry / rz + 1) * 0.5;
        }
      } else if (ax >= ay && ax >= az) {
        if (rx > 0) {
          fKey = 'right';
          u = (-rz / rx + 1) * 0.5;
          v = (-ry / rx + 1) * 0.5;
        } else {
          fKey = 'left';
          u = (-rz / rx + 1) * 0.5;
          v = (ry / rx + 1) * 0.5;
        }
      } else {
        if (ry > 0) {
          fKey = 'top';
          u = (rx / ry + 1) * 0.5;
          v = (rz / ry + 1) * 0.5;
        } else {
          fKey = 'bottom';
          u = (-rx / ry + 1) * 0.5;
          v = (rz / ry + 1) * 0.5;
        }
      }

      const tx = Math.max(0, Math.min(faceSize - 1, (u * faceSize) | 0));
      const ty = Math.max(0, Math.min(faceSize - 1, (v * faceSize) | 0));

      const sourceIdx = (ty * faceSize + tx) * 4;
      const fPixels = faceData[fKey];

      data[rowIdx]     = fPixels[sourceIdx];
      data[rowIdx + 1] = fPixels[sourceIdx + 1];
      data[rowIdx + 2] = fPixels[sourceIdx + 2];
      data[rowIdx + 3] = 255;

      rowIdx += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Generates a synthetic 360 panorama for testing or missing data.
 */
export async function generateSynthetic360Panorama(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, 2048);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(0.5, '#166534');
  grad.addColorStop(1, '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4096, 2048);

  return canvas.toDataURL('image/jpeg');
}

export function flipImageVertically(dataUrl: string): Promise<string> {
  return transformImage(dataUrl, (ctx, canvas, img) => {
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0);
  });
}

export function flipImageHorizontally(dataUrl: string): Promise<string> {
  return transformImage(dataUrl, (ctx, canvas, img) => {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  });
}

function transformImage(
  dataUrl: string, 
  transform: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, img: HTMLImageElement) => void
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        transform(ctx, canvas, img);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      }
    };
    img.src = dataUrl;
  });
}
