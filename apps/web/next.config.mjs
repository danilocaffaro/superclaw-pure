/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',
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
