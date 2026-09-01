/**
 * Colour mode: light | dark | system, with `system` a real selectable value
 * rather than merely an initial condition.
 *
 * Forced by ADR-0002's `ssr: false` + `prerender`: every page is built once and
 * served identically, so NOTHING resolves per request. There is no cookie to
 * read and no server to stamp a class. A localStorage-driven theme can only be
 * applied by JS, and unless that JS runs before first paint there is a flash of
 * the wrong theme on every one of ~600 pages.
 *
 * Three consequences, each of which is otherwise rediscovered painfully:
 *
 *   1. React must NEVER render a theme class or data-theme onto <html>. The
 *      inline script owns those attributes exclusively. If React also renders
 *      them, every page logs a hydration mismatch.
 *   2. A mode control cannot know its own state during prerender — the HTML is
 *      identical for all visitors. It renders neutral and syncs on mount, or
 *      reads the class off the DOM. Never from a build-time value.
 *   3. `system` requires a live matchMedia listener that re-stamps when the OS
 *      flips mid-session. A two-state toggle would not need this.
 */

export type Mode = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

export const MODE_KEY = 'awk-mode'
export const THEME_KEY = 'awk-theme'
export const DEFAULT_THEME = 'ember'

/**
 * Stringified into the document head via dangerouslySetInnerHTML so
 * prerendering inlines it into every page. Must stay small and must stay
 * BLOCKING — no async, no defer, no module.
 *
 * It always writes an explicit light/dark class, which is why the CSS needs
 * only the class selector and never a media query: one selector rather than two
 * overlapping ones.
 *
 * `data-mode` is the STORED mode, and it is what lets the mode control show its
 * own state in the first paint. Consequence 2 above is why it has to come from
 * here: React cannot render the selected segment, so before this attribute
 * existed the control painted three identical unfilled segments on all ~641
 * pages and only grew a highlight once `useEffect` ran. mode-toggle.css keys the
 * selected fill off this, and React Aria's [data-selected] takes over on
 * hydration setting the same values.
 *
 * NOT the same value as the class. The class is the RESOLVED light/dark, because
 * that is what colours the page; this is the raw choice including `system`,
 * because that is what the control has a segment for. Collapsing them would
 * leave `system` unhighlightable.
 */
export const themeScript = `
(function(){
  try {
    var m = localStorage.getItem("${MODE_KEY}") || "system";
    var t = localStorage.getItem("${THEME_KEY}") || "${DEFAULT_THEME}";
    var dark = m === "dark" ||
      (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    r.classList.add(dark ? "dark" : "light");
    r.setAttribute("data-theme", t);
    r.setAttribute("data-mode", m);
    r.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.classList.add("light");
    document.documentElement.setAttribute("data-theme", "${DEFAULT_THEME}");
    document.documentElement.setAttribute("data-mode", "system");
  }
})();
`.trim()

export function getMode(): Mode {
  if (typeof localStorage === 'undefined') return 'system'
  const m = localStorage.getItem(MODE_KEY)
  return m === 'light' || m === 'dark' || m === 'system' ? m : 'system'
}

export function resolve(mode: Mode): Resolved {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Applies a mode and persists it. The only writer of the class, post-hydration. */
export function setMode(mode: Mode): void {
  localStorage.setItem(MODE_KEY, mode)
  const r = resolve(mode)
  const root = document.documentElement
  root.classList.toggle('dark', r === 'dark')
  root.classList.toggle('light', r === 'light')
  // Kept in step with the class, for the same reason the script sets it. Writing
  // the stored mode rather than the resolved one, so `system` stays `system` here
  // even as the class flips underneath it — which is exactly what watchSystem
  // does when the OS changes mid-session.
  root.setAttribute('data-mode', mode)
  root.style.colorScheme = r
}

/** Re-stamps when the OS flips while `system` is selected. Returns a cleanup. */
export function watchSystem(): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getMode() === 'system') setMode('system')
  }
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
