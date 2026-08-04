import { type RouteConfig, index, route } from '@react-router/dev/routes'

/**
 * URL structure is ADR-0001, not a preference. The shape that matters:
 *
 *   /projects                                        index
 *   /projects/<slug>                                 case study (only if body)
 *   /concerts                                        index
 *   /concerts/<date>                                 keyed by date, e.g. 2008-12-13
 *   /concerts/composers                              A–Z index
 *   /concerts/composers/<composer>                   composer page
 *   /concerts/composers/<composer>/works/<work>      work page, canonical
 *
 * Works nest under their composer deliberately. A flat composer-prefixed slug was
 * considered and dropped, and the nesting is what makes `work.slug` need only be
 * unique PER COMPOSER — which is why ADR-0008 removed `unique: true` from it and
 * replaced it with a build assertion, Contentful being unable to express a scoped
 * unique.
 *
 * Two paths are deliberately absent and permanently reserved — see ADR-0001,
 * "Reserved paths". `/music` is Alex's own original work; `/2-or-3-things` is the
 * blog. Route neither, and give neither a placeholder: a reserved path 404s, which
 * is only true while no catch-all redirect exists.
 *
 * Ordering note: `/concerts/composers` and `/concerts/:date` both match
 * "/concerts/composers". React Router ranks static segments above dynamic ones, so
 * the static route wins — but do not reorder these on the assumption that source
 * order decides it.
 *
 * Facets are NOT routes. Soloist, conductor, hall, period and form filter via the
 * query string on the indexes, which is the decision that keeps this section at
 * ~590 pages instead of ~870.
 */
export default [
  index('routes/home.tsx'),

  route('projects', 'routes/projects.tsx'),
  route('projects/:slug', 'routes/project.tsx'),

  route('concerts', 'routes/concerts.tsx'),
  route('concerts/composers', 'routes/composers.tsx'),
  route('concerts/composers/:composer', 'routes/composer.tsx'),
  route('concerts/composers/:composer/works/:work', 'routes/work.tsx'),
  route('concerts/:date', 'routes/concert.tsx'),

  /* Two paths outside both sections, and the only pages that are neither a
     section index nor a content record. ADR-0001's Contact section, amended onto
     it by AWK-26; ADR-0011 has the form's own constraints.

     `contact/sent` is a sibling route, not a child of `contact` — there is no
     shared layout, and nesting would put an <Outlet /> in the form page. */
  route('contact', 'routes/contact.tsx'),
  route('contact/sent', 'routes/contact-sent.tsx'),
] satisfies RouteConfig
