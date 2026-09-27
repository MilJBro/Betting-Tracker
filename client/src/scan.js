import { api } from './api.js';

// Read an image File, downscale it so the longest side is <= maxDim, and return
// base64 JPEG data suitable for the scan endpoint. Screenshots are often large;
// shrinking them keeps the upload fast and the vision call cheap without losing
// the legibility of the text on a bet slip.
export function fileToScaledImage(file, maxDim = 1400, quality = 0.78) {
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

// Upload one or more bet-slip screenshots and get back the extracted bet.
// Accepts a single File or an array — a long slip (10+ selections) rarely fits
// one screenshot, so the user can snap it in parts (top, middle, bottom) and the
// server stitches them into one bet. Capped at 4 images to keep it fast/cheap.
export async function scanBetSlip(files) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean).slice(0, 4);
  const images = [];
  for (const f of list) {
    const { image, mediaType } = await fileToScaledImage(f);
    images.push({ data: image, mediaType });
  }
  // Hard cap so a stalled request fails cleanly instead of hanging the scan
  // overlay forever; a little longer when several images are sent.
  const timeoutMs = images.length > 1 ? 55000 : 35000;
  return api.post('/bets/scan', { images }, { timeoutMs }); // { bet, confidence, currency }
}
