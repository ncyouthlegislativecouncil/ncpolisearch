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
};

export default nextConfig;
