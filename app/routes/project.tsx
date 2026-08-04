import { PROJECTS } from '../data/sample'

/**
 * A case study — the one surface driven by `.typeset-reading` rather than
 * `.typeset-compact`, and the reason two presets exist at all. Note the `typeset`
 * base class is required alongside the preset; the preset is variable overrides
 * only, so on its own it renders nothing.
 *
 * The body is RichText with embedded Assets in Contentful (ADR-0003). Rendered
 * here as static markup so the typographic rhythm is judgeable; swap in the
 * rich-text renderer when the CDA is wired.
 *
 * `imageGroup` MUST tolerate any number of images, permanently: Contentful can
 * set min/max on an array but cannot make that conditional on another field, so
 * `sideBySide` carrying five images is authorable and always will be. That is
 * why a before/after slider and a tab control were both rejected — each assumes
 * exactly two images of matched dimensions, which the model never guarantees.
 */
export default function Project() {
  const project = PROJECTS[0]

  return (
    <main className="px-[var(--gutter)] py-[var(--space-section)]">
      <article className="mx-auto max-w-[var(--width-content)]">
        <header>
          <p className="text-[0.72rem] tracking-[0.14em] text-muted-foreground uppercase">
            Case study · {project.organization}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{project.title}</h1>
          <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">{project.summary}</p>

          <dl className="mt-5 flex flex-wrap gap-8 border-t border-border-subtle pt-4">
            <div>
              <dt className="text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">Years</dt>
              <dd className="tabular mt-0.5 text-sm">{project.years}</dd>
            </div>
            <div>
              <dt className="text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">Live</dt>
              <dd className="mt-0.5 text-sm">
                {project.liveUrl ? <a href={project.liveUrl}>{project.liveUrl.replace('https://', '')}</a> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">Technologies</dt>
              <dd className="mt-0.5 text-sm">{project.technologies.join(' · ')}</dd>
            </div>
          </dl>
        </header>

        {/* Base `typeset` class plus our preset — the preset alone is inert. */}
        <div className="typeset typeset-reading mt-10 max-w-[var(--measure)]">
          <h2>The problem was never the components</h2>
          <p>
            When I joined, dv01 had four button implementations and no shared vocabulary for describing them. The
            interesting part of the work was not building a fifth button. It was finding out why the previous four had
            happened, and making the fifth one the path of least resistance.
          </p>
          <p>
            That reframing is what turned a component library into a design system. A library is a folder of components.
            A system is a set of decisions about which components may exist, expressed so that following them is easier
            than not.
          </p>

          <h3>Tokens came before components</h3>
          <p>
            The first shipped artifact was not a component at all — it was a three-layer token contract. Primitives,
            semantic aliases, then framework bindings. Product engineers reached for <code>bg-surface-raised</code>{' '}
            instead of a hex value, and the hex value became something the system could change without a migration.
          </p>

          <blockquote>
            A token nobody uses is worse than a missing one, because it looks like something depends on it.
          </blockquote>

          {/* imageGroup · layout: sideBySide. Stacks narrow, two columns wide.
              alt comes from each Asset's `title`, caption from its `description`,
              read off the asset rather than passed as parallel arrays — which
              would misalign silently on reorder. */}
          <figure className="m-0 grid gap-4 md:grid-cols-2">
            <div
              className="aspect-[4/3] rounded-[var(--radius)] border border-border-subtle bg-[repeating-linear-gradient(0deg,var(--muted)_0_8px,var(--card)_8px_16px)]"
              role="img"
              aria-label="Before: four divergent button implementations"
            />
            <div
              className="aspect-[4/3] rounded-[var(--radius)] border border-border-subtle bg-[linear-gradient(135deg,var(--primary),var(--muted)_70%)]"
              role="img"
              aria-label="After: one tokenised button"
            />
            <figcaption className="col-span-full mt-1 text-xs text-muted-foreground">
              Before and after: the token contract replacing four button implementations.
            </figcaption>
          </figure>

          <p>
            The tables were the hard part. AG Grid brings its own opinions about layout, density and focus, and a
            loan-analytics product is mostly tables. The pattern we landed on wraps AG Grid rather than restyling it, so
            a consumer changing one column&rsquo;s behaviour cannot change every other consumer&rsquo;s.
          </p>
        </div>
      </article>
    </main>
  )
}
