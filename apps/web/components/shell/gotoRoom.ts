// Client navigation to a room, with a hard-navigation fallback. In dev, a blocked/failed RSC
// fetch (e.g. the page opened from 127.0.0.1 or a LAN IP, or a 307 on /r/CODE?_rsc=) makes
// router.push hang forever; a full page load always works.
export function gotoRoom(router: { push: (href: string) => void }, code: string) {
  const href = `/r/${code}`;
  router.push(href);
  window.setTimeout(() => {
    if (window.location.pathname !== href) window.location.assign(href);
  }, 2500);
}
