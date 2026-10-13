// Client navigation to a room, with a hard-navigation safety net. If a soft navigation never lands
// (e.g. a stuck dev-server RSC fetch), a full page load always works. The fallback only fires if
// the user is still on the page they started from, so Back/Home within the window is respected.
const FALLBACK_MS = 2500;

export function gotoRoom(router: { push: (href: string) => void }, code: string) {
  const href = `/r/${code}`;
  const from = window.location.pathname;
  router.push(href);
  window.setTimeout(() => {
    if (window.location.pathname === from) {
      console.warn(`router.push(${href}) did not navigate; falling back to a full page load`);
      window.location.assign(href);
    }
  }, FALLBACK_MS);
}
