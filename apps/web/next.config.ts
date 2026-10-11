import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@dbay/protocol', '@dbay/content'],
};

export default config;
