import { redirect } from 'next/navigation'

// Post-login landing. The editorial home is the template library (one-click
// replicate is the zero-friction entry); the header carries credits, nav,
// logout and the admin entry, so a standalone dashboard adds nothing.
// Magic-link callbacks point here (next=/dashboard) — keep the route, redirect it.
export default function Dashboard() {
  redirect('/templates')
}
