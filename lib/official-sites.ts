/**
 * Official AutoCount sources.
 * - Help centres: indexed daily from their published sitemaps (see supabase/functions/refresh-official) and searched in-app.
 * - Other sites (website, wiki): no public sitemap/search the app may use, so they're offered as Google searches limited to those sites.
 */
export const HELP_CENTRES = [
  { domain: "help.accounting.autocountcloud.com", label: "AutoCount Cloud Accounting help centre" },
  { domain: "help.hrms.autocountcloud.com", label: "AutoCount HRMS / Payroll help centre" },
] as const;

export const OTHER_OFFICIAL_SITES = [
  { domain: "autocountsoft.com", label: "AutoCount website" },
  { domain: "wiki.autocountsoft.com", label: "AutoCount wiki" },
] as const;

export const OFFICIAL_SITES = [...HELP_CENTRES, ...OTHER_OFFICIAL_SITES];
export const OFFICIAL_DOMAINS: readonly string[] = OFFICIAL_SITES.map((s) => s.domain);

export interface OfficialHit {
  title: string;
  url: string;
  snippet: string;
  site: string;
  lastmod?: string | null;
  matchedBy?: string[];
}

/** "query (site:a OR site:b …)" for a site-limited Google search. */
export function buildSiteQuery(query: string, domains: readonly string[] = OFFICIAL_DOMAINS) {
  const sites = domains.map((d) => `site:${d}`).join(" OR ");
  return `${query.trim()} (${sites})`;
}

/** Google search limited to the given official sites (all of them by default). */
export function googleFallbackUrl(query: string, domains: readonly string[] = OFFICIAL_DOMAINS) {
  return `https://www.google.com/search?q=${encodeURIComponent(buildSiteQuery(query, domains))}`;
}

/** True only for http(s) links whose host is an official site or one of its subdomains. */
export function isAllowedUrl(url: string, domains: readonly string[] = OFFICIAL_DOMAINS) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Friendly site name for a link (most specific match wins, so the wiki isn't labelled as the website). */
export function siteLabel(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  const match = [...OFFICIAL_SITES].sort((a, b) => b.domain.length - a.domain.length).find((s) => host === s.domain || host.endsWith(`.${s.domain}`));
  return match?.label ?? host;
}
