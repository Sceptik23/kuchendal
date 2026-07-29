import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kuhhandel/ui', '@kuhhandel/shared-types'],
  webpack(config) {
    // These workspace packages use NodeNext-style ESM imports (e.g.
    // `./types.js`) that point at `.ts` source files on disk. Without this,
    // webpack's resolver looks for a literal `types.js` and fails.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
