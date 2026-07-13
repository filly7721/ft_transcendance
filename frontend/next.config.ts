import type { NextConfig } from "next";

// The dev server refuses cross-origin requests to its dev-only endpoints unless
// the origin is listed in allowedDevOrigins, which bites the moment the app is
// opened over the LAN (another machine, a phone) instead of on localhost.
//
// That host is the same one the backend is served from, so take it from the API
// URL already in .env rather than keeping a second copy of the address here —
// moving to a new network is then one edit, not two. Next loads .env before it
// imports this file, so the variable is set by the time we read it. Nothing to
// allow when it is unset: localhost is permitted by default.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const allowedDevOrigins = apiUrl ? [new URL(apiUrl).hostname] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async redirects() {
    // Games moved from /games/<slug> to /lobby/<slug>
    return [
      { source: "/games/:slug", destination: "/lobby/:slug", permanent: false },
    ];
  },
};

export default nextConfig;
