import { PROFILES } from '../data/profiles'

/**
 * /contact/ — a Netlify Forms contact form. ADR-0011, decided in AWK-26.
 *
 * NO function and no edge function. Netlify Forms is a platform feature: the
 * build post-processor scans the DEPLOYED HTML for a form carrying
 * `data-netlify="true"`, strips that attribute, and injects a hidden `form-name`
 * input. Submissions POST to the site's own origin and land in a managed store.
 *
 * It works here precisely BECAUSE the site is prerendered. Netlify's docs warn
 * that forms rendered client-side by React are not detected — detection needs the
 * markup present at deploy time — and prescribe shipping a duplicate hidden form
 * for the scanner. `ssr: false` + `prerender` emits real HTML per route, so this
 * lands on the supported side of a warning it was never aiming at and needs no
 * workaround. Do not "helpfully" add that duplicate form.
 *
 * Three things here are load-bearing:
 *
 *  1. A plain `<form>`, NEVER React Router's `<Form>`. `<Form>` intercepts the
 *     submission into an `action` export, which `ssr: false` cannot have. The
 *     native POST is also why the form needs no JavaScript and adds nothing to
 *     the client bundle, keeping ADR-0004's interactive surface at one file.
 *
 *  2. `action` is SLASH-FUL. Netlify serves /contact/sent/index.html and 301s the
 *     slash-free form, so posting to /contact/sent would take a redirect hop
 *     mid-submission. The prerender enumerator is the opposite — slash-free there
 *     is a hard build failure. Two layers, both correct.
 *
 *  3. There is no `<input name="form-name">` below, because Netlify INJECTS it
 *     during post-processing — so the deployed HTML differs from build/client on
 *     this page, the first place in this pipeline where that is true.
 *
 *     UNVERIFIED, and the one thing here that can fail silently. That injected
 *     input is a DOM node absent from React's tree, inside a form React hydrates
 *     (root.tsx renders <Scripts /> sitewide). React 19 may discard it as a
 *     hydration mismatch, and a JS-enabled submit would then POST without
 *     `form-name`, which Netlify rejects — while a no-JS submit still works,
 *     making it look intermittent. Nothing local can test this; it needs the real
 *     deploy in AWK-34.
 *
 *     If it does fail, the fix is to author the hidden input here and keep
 *     `data-netlify` — the documented approach for client-rendered forms. It is
 *     not the default only because the ADR describes injection as the mechanism,
 *     and a second `form-name` field may break the POST its own way.
 *
 * Spam handling is honeypot plus Akismet and nothing else. reCAPTCHA is
 * unavailable by prior decision, not preference: Netlify's built-in option
 * injects Google's script, which ADR-0010 bans outright and whose CSP would block
 * it anyway.
 */
export default function Contact() {
  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <div className="mx-auto max-w-[var(--width-content)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-1 max-w-[52ch] text-sm text-muted-foreground">
          Send a message and it reaches me directly. For anything public, the profile links below are the faster route.
        </p>

        <form
          name="contact"
          method="POST"
          action="/contact/sent/"
          data-netlify="true"
          netlify-honeypot="bot-field"
          className="contact-form mt-6"
        >
          <div className="contact-field">
            <label className="contact-label" htmlFor="contact-name">
              Name
            </label>
            <input className="contact-input" id="contact-name" name="name" type="text" autoComplete="name" required />
          </div>

          <div className="contact-field">
            <label className="contact-label" htmlFor="contact-email">
              Email
            </label>
            <input
              className="contact-input"
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="contact-field">
            <label className="contact-label" htmlFor="contact-message">
              Message
            </label>
            <textarea className="contact-textarea" id="contact-message" name="message" rows={7} required />
          </div>

          {/*
            The honeypot. Bots complete it, humans never see it, and Netlify
            rejects any submission that arrives with it filled. `aria-hidden` and
            `tabIndex={-1}` so it is unreachable rather than merely invisible —
            a screen reader user must not be handed a field whose only purpose is
            to be left empty. Netlify strips the `netlify-honeypot` attribute
            above during post-processing.
          */}
          <p className="contact-honeypot" aria-hidden="true">
            <label>
              Leave this field empty
              <input name="bot-field" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </p>

          <button className="contact-submit" type="submit">
            Send
          </button>
        </form>

        <section className="mt-10 border-t border-border-subtle pt-5">
          <h2 className="contact-eyebrow">Elsewhere</h2>
          <ul className="mt-2 grid list-none gap-1 p-0 text-sm">
            {PROFILES.map((p) => (
              <li key={p.label}>
                <a href={p.href} className="no-underline hover:underline">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
