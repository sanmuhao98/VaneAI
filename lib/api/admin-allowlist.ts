// Pure allowlist check shared by the (admin) layout, admin API guard, and
// conditional admin UI. CSV from ADMIN_EMAILS; comparison is case-insensitive.
export function isAdminEmail(email: string | undefined, adminEmailsCsv: string | undefined): boolean {
  if (!email || !adminEmailsCsv) return false
  const needle = email.trim().toLowerCase()
  if (!needle) return false
  return adminEmailsCsv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(needle)
}
