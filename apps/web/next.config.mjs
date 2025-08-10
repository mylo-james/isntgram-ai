/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
        throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be set in production');
      }
    }
    return config;
  },
};

export default nextConfig;
