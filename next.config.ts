import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep Vinext's rendered canonical and Open Graph URLs aligned with the
  // normalized root URL used by the sitemap, JSON-LD and discovery guides.
  trailingSlash: true,
};

export default nextConfig;
