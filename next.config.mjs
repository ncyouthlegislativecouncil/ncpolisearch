/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next's client-side Router Cache reuses a cached render of a dynamic page
    // (e.g. /bills or /legislators with filters in searchParams) when the user
    // hits the browser Back button, which can show stale/reverted filter state
    // instead of what the URL actually says. Setting dynamic staleTime to 0
    // forces a fresh render on every navigation to these pages, so filters
    // (chamber, status, party, search) always match the URL after Back/Forward.
    staleTimes: {
      dynamic: 0,
    },
  },
  // The site used to live only at ncpolisearch.vercel.app, and Google still
  // lists that address. Permanently redirect it to the real domain so search
  // results (and old shared links) consolidate there. Matches only that exact
  // host, so preview deployments are unaffected, and skips /api so the daily
  // cron poll can never get bounced by a redirect.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "ncpolisearch.vercel.app" }],
        destination: "https://www.ncpolisearch.com/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
