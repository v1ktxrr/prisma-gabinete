import { withVisualEdit as withBefreeVisualEdit } from 'befree-visual-edit/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone",
  images: {
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  turbopack: {},
};

export default withBefreeVisualEdit(nextConfig);
