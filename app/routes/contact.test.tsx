import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Contact from "./contact";

/**
 * What is worth testing on this page is not that it renders — it is the exact set
 * of attributes Netlify's build-time scanner reads, and the two things ADR-0011
 * forbids. Every assertion here maps to a way the form can fail SILENTLY: wrong
 * attribute, no submission stored, and no build error either way.
 *
 * RTL's auto-cleanup needs a global `afterEach`, which this project does not have
 * (vitest globals are off, so everything is imported). Hence the explicit hook.
 */
describe("/contact", () => {
  afterEach(cleanup);

  function renderForm() {
    const { container } = render(<Contact />);
    const form = container.querySelector("form");
    if (!form) throw new Error("no <form> rendered");
    return { container, form };
  }

  it("carries ADR-0011's form attributes verbatim", () => {
    const { form } = renderForm();

    // The scanner keys off name + data-netlify; Netlify's endpoint keys off
    // method + action. All four have to be exactly this.
    expect(form.getAttribute("name")).toBe("contact");
    expect(form.getAttribute("method")).toBe("POST");
    expect(form.getAttribute("action")).toBe("/contact/sent/");
    expect(form.getAttribute("data-netlify")).toBe("true");
    expect(form.getAttribute("netlify-honeypot")).toBe("bot-field");
  });

  it("posts to a slash-FUL action, so the submission takes no redirect hop", () => {
    const { form } = renderForm();

    expect(form.getAttribute("action")?.endsWith("/")).toBe(true);
  });

  it("is a plain form, not React Router's <Form>", () => {
    // Two independent proofs. React Router's <Form> marks itself with
    // data-discover, and — decisively — it throws outside a router context, so
    // rendering with no RouterProvider at all is only possible for a native form.
    const { form } = renderForm();

    expect(form.hasAttribute("data-discover")).toBe(false);
  });

  it("does not author form-name — Netlify injects it at deploy", () => {
    const { container } = renderForm();

    expect(container.querySelector('[name="form-name"]')).toBeNull();
  });

  it("names the three fields the submission is read by", () => {
    const { container } = renderForm();

    for (const field of ["name", "email", "message"]) {
      expect(container.querySelector(`[name="${field}"]`)).not.toBeNull();
    }
  });

  it("hides the honeypot from people, not just from view", () => {
    const { container } = renderForm();
    const honeypot = container.querySelector('[name="bot-field"]');

    expect(honeypot).not.toBeNull();
    // Unreachable by keyboard, and its wrapper is hidden from assistive tech — a
    // screen reader user must not be handed a field whose only job is to stay
    // empty. display:none lives in contact-form.css, which is not loaded here.
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("never publishes the mailbox address", () => {
    const { container } = renderForm();

    // ADR-0011: the form exists so `hi@awkale.me` is never scraped, and an
    // address cannot be un-scraped. No address, and no mailto: anywhere.
    expect(container.innerHTML).not.toContain("hi@awkale.me");
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("links the three profiles ADR-0011 names", () => {
    const { container } = renderForm();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("https://github.com/awkale");
    expect(hrefs.some((h) => h?.includes("threads.com"))).toBe(true);
    expect(hrefs.some((h) => h?.includes("linkedin.com"))).toBe(true);
  });
});
