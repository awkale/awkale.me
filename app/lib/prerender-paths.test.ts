import { afterEach, describe, expect, it, vi } from "vitest";
import { prerenderPaths } from "./prerender-paths";

/**
 * The enumerator is the one place that decides which pages exist, so its two
 * guards matter more than its output: with `ssr: false`, a path that is wrong here
 * is a page that either fails the build or 404s in production.
 *
 * The guard tests mock app/data/sample rather than the enumerator, because the
 * guards are internal by design — the point is that BAD DATA cannot get through,
 * not that a helper rejects a bad string. `vi.doMock` plus `resetModules` is what
 * lets each case supply its own fixture; `vi.mock` would hoist and apply to all.
 */
describe("prerenderPaths", () => {
  afterEach(() => {
    vi.doUnmock("../data/sample");
    vi.resetModules();
  });

  it("enumerates both contact pages (ADR-0011)", async () => {
    const paths = await prerenderPaths();

    expect(paths).toContain("/contact");
    expect(paths).toContain("/contact/sent");
  });

  it("emits every path slash-free, since a trailing slash is a hard build failure", async () => {
    const paths = await prerenderPaths();
    const offenders = paths.filter((p) => p !== "/" && p.endsWith("/"));

    expect(offenders).toEqual([]);
  });

  it("emits no duplicates", async () => {
    const paths = await prerenderPaths();

    expect(paths).toHaveLength(new Set(paths).size);
  });

  it("emits absolute paths only", async () => {
    const paths = await prerenderPaths();
    const offenders = paths.filter((p) => !p.startsWith("/"));

    expect(offenders).toEqual([]);
  });

  it("throws rather than emitting a trailing-slash path", async () => {
    // An empty project slug is the realistic way this happens: Contentful can
    // hold a published entry whose slug was never filled, and `/projects/` would
    // fail the build with a message about the route, not the data.
    vi.resetModules();
    vi.doMock("../data/sample", () => ({
      CONCERTS: [],
      COMPOSERS: [],
      WORK: { composer: "Beethoven, Ludwig van", slug: "symphony-no-5" },
      PROJECTS: [{ slug: "", hasBody: true }],
    }));

    const { prerenderPaths: withBadSlug } = await import("./prerender-paths");

    await expect(withBadSlug()).rejects.toThrow(/trailing slash/);
  });

  it("throws rather than emitting a duplicate path", async () => {
    // Two concerts on one date. ADR-0001 keys concert URLs BY DATE, so a genuine
    // double-header is data this guard has to catch rather than silently collapse.
    vi.resetModules();
    vi.doMock("../data/sample", () => ({
      CONCERTS: [{ slug: "2008-12-13" }, { slug: "2008-12-13" }],
      COMPOSERS: [],
      WORK: { composer: "Beethoven, Ludwig van", slug: "symphony-no-5" },
      PROJECTS: [],
    }));

    const { prerenderPaths: withDupe } = await import("./prerender-paths");

    await expect(withDupe()).rejects.toThrow(/duplicate/);
  });
});
