/** Websites that "Official sources" search is restricted to. Editable in Settings. */
export const OFFICIAL_SITES = [
  { domain: "autocountsoft.com", label: "AutoCount website" },
  { domain: "wiki.autocountsoft.com", label: "AutoCount wiki" },
  { domain: "help.accounting.autocountcloud.com", label: "AutoCount Accounting help centre" },
  { domain: "help.hrms.autocountcloud.com", label: "AutoCount HRMS / Payroll help centre" },
] as const;

/** Google search limited to the official sites, used when SearXNG is unavailable. */
export function googleFallbackUrl(query: string, domains: readonly string[] = OFFICIAL_SITES.map((s) => s.domain)) {
  const sites = domains.map((d) => `site:${d}`).join(" OR ");
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} (${sites})`)}`;
}
