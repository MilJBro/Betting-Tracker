import { isStandalone, isIOS } from './pwa.js';

// Save a generated file (CSV, JSON export…) to the user's device.
//
// On an installed iOS app, a normal `<a download>` click navigates the single
// webview to the blob URL (iOS can't download a file in place there), which
// knocks the user out of the app and leaves it stuck reloading on return. So on
// iOS / standalone we hand the file to the native share sheet instead ("Save to
// Files", AirDrop, etc.), which never navigates away. Everywhere else we use the
// classic anchor download.
export async function saveFile(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });

  if ((isStandalone() || isIOS()) && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      // The user dismissed the share sheet — that's fine, nothing more to do.
      if (err && err.name === 'AbortError') return;
      // Any other failure: fall through to the anchor download below.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
