import type { MetadataRoute } from "next";

// Crawlers get every real page (bills, legislators, results) but not the
// endless filter/sort/page-number and compare combinations. Those pages are
// rendered on demand, and crawling them is what ran up Vercel usage.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/compare?", "/bills?", "/legislators?", "/*?vpage="],
    },
    sitemap: "https://www.ncpolisearch.com/sitemap.xml",
  };
}
