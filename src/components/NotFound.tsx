import { Link } from '@tanstack/react-router'

/**
 * Rendered for every unmatched URL, `/dashboard` included.
 *
 * Without it TanStack renders the root shell and an empty `<Outlet/>`: F7's
 * deployed pass found the retired `/dashboard` serving the header, the tracking
 * banner and — because `hideFilterBar` was an opt-out list that no longer named
 * it — a **FilterBar**, floating above nothing at all. A stale bookmark landed
 * on a blank page with a project multi-select on it and no explanation, which is
 * worse than either a 404 or a redirect. (`AppLayout` inverted that list to an
 * allowlist in the same change, so an unmatched route can never inherit page
 * furniture again.)
 *
 * A redirect is still the wrong answer for `/dashboard` specifically: its
 * contents went to three different routes — §4.1 took the KPI cards, §4.2 the
 * adoption/accuracy charts, §4.3 the quality signals — so there is no honest
 * single destination. Naming all three is.
 */
export function NotFound() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-5 py-6">
      <h1 className="text-sm font-semibold text-neutral-900">This page doesn’t exist.</h1>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
        If you followed a bookmark to <code>/dashboard</code>, that page was retired — it was the
        last surface reading the pre-redesign views, and its contents now live in three places
        rather than one.
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        <li>
          <Link to="/radar" className="font-medium text-blue-600 hover:underline">
            Radar
          </Link>
          <span className="text-neutral-500">
            {' '}
            — the KPI cards, plus what needs attention this week
          </span>
        </li>
        <li>
          <Link to="/estimation" className="font-medium text-blue-600 hover:underline">
            Estimation
          </Link>
          <span className="text-neutral-500">
            {' '}
            — the adoption and accuracy trends, on canonical data
          </span>
        </li>
        <li>
          <Link to="/quality" className="font-medium text-blue-600 hover:underline">
            Quality
          </Link>
          <span className="text-neutral-500"> — the QA signals section</span>
        </li>
      </ul>
    </div>
  )
}
