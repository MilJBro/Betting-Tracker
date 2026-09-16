import { api } from './api.js';

// Read an image File, downscale it so the longest side is <= maxDim, and return
// base64 JPEG data suitable for the scan endpoint. Screenshots are often large;
// shrinking them keeps the upload fast and the vision call cheap without losing
// the legibility of the text on a bet slip.
export function fileToScaledImage(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please choose an image.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ image: base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened.'));
    };
    img.src = url;
  });
}

// Upload a bet-slip screenshot and get back the extracted bet fields.
export async function scanBetSlip(file) {
  const { image, mediaType } = await fileToScaledImage(file);
  return api.post('/bets/scan', { image, mediaType }); // { bet, confidence, currency }
}
