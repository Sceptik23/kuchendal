import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @kuhhandel/shared-types now re-exports a runtime value
  // (SPECIES_FAMILY_VALUE) from @kuhhandel/game-engine, so both packages'
  // TS/ESM sources need to be transpiled by webpack, not just type-erased.
  transpilePackages: ['@kuhhandel/ui', '@kuhhandel/shared-types', '@kuhhandel/game-engine'],
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
