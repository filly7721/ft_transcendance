import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Games moved from /games/<slug> to /lobby/<slug>
    return [{ source: "/games/:slug", destination: "/lobby/:slug", permanent: false }];
  },
};

export default nextConfig;
