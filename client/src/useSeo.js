import { useEffect } from 'react';

// Sets the document title + meta description for a page (and optionally injects
// JSON-LD structured data), restoring the previous values on unmount. Google
// renders client-side JS, so this gives each public page its own SEO metadata.
export function useSeo(title, description, jsonLd) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const metaEl = document.querySelector('meta[name="description"]');
    const prevDesc = metaEl ? metaEl.getAttribute('content') : null;
    if (metaEl && description) metaEl.setAttribute('content', description);

    let script;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = prevTitle;
      if (metaEl && prevDesc != null) metaEl.setAttribute('content', prevDesc);
      if (script) script.remove();
    };
  }, [title, description, jsonLd]);
}
