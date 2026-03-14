/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',
  // B5: Expose ENABLE_MESSAGE_BUS flag to the browser bundle
  env: {
    NEXT_PUBLIC_ENABLE_MESSAGE_BUS: process.env.ENABLE_MESSAGE_BUS ?? 'true',
  },
  ...(process.env.NEXT_OUTPUT === 'export' ? {} : {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:4070/:path*',
        },
      ];
    },
  }),
};

export default nextConfig;
