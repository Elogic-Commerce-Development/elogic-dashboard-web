import { Link } from '@tanstack/react-router'

/**
 * Rendered for every unmatched URL.
 *
 * It exists because deleting a route leaves no 404 of its own: TanStack renders
 * the root shell and an empty `<Outlet/>`, so F7's deployed pass found a retired
 * route serving a header, a banner and a project multi-select floating above
 * nothing. (`AppLayout` inverted FilterBar visibility to an allowlist in the
 * same change, so an unmatched route can no longer inherit page furniture.)
 *
 * **The copy names no specific retired route, deliberately.** The first version
 * of this page explained that `/dashboard` had been retired — and then
 * `/dashboard` came back, leaving a 404 page confidently telling people a live
 * page was gone. That is the third time in this session that prose went stale
 * because the code under it moved, so this version states only what cannot rot:
 * the address does not match a page, and here is where to go instead.
 */
export function NotFound() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-5 py-6">
      <h1 className="text-sm font-semibold text-neutral-900">This page doesn’t exist.</h1>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
        The address doesn’t match any page here. If you followed a bookmark, it may point at a
        page that was retired or renamed during the redesign — use the navigation above, or start
        from one of these:
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        <li>
          <Link to="/dashboard" className="font-medium text-blue-600 hover:underline">
            Dashboard
          </Link>
          <span className="text-neutral-500"> — the rolled-up overview</span>
        </li>
        <li>
          <Link to="/radar" className="font-medium text-blue-600 hover:underline">
            Radar
          </Link>
          <span className="text-neutral-500"> — what needs attention this week</span>
        </li>
        <li>
          <Link to="/estimation" className="font-medium text-blue-600 hover:underline">
            Estimation
          </Link>
          <span className="text-neutral-500"> — coverage, calibration and overrun economics</span>
        </li>
      </ul>
    </div>
  )
}
