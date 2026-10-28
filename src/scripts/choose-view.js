// Runs inline in <head>, before first paint, so choosing the island map or the plain page
// never makes the layout jump. Reduced motion gets the page by default; the toggle switches.
(() => {
  const html = document.documentElement;
  let view = null;
  try {
    view = localStorage.getItem('view');
  } catch {
    // Storage blocked: fall through to the default.
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (view === 'map' || (view !== 'page' && !reduce)) {
    html.classList.add('game');
    // If the map script never runs, show the page instead of an empty sea.
    setTimeout(() => {
      if (!html.classList.contains('game-ready')) html.classList.remove('game');
    }, 8000);
  }
})();
