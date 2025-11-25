import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: true,
  devIndicators: {
    position: 'bottom-left',
  },
};

export default nextConfig;
