import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@citadels/game-logic'],
  output: 'export',
};

export default nextConfig;
