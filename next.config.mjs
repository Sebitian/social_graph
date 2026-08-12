/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phone / LAN access in `next dev` — include both host and host:port forms
  allowedDevOrigins: ["10.0.0.169", "10.0.0.169:3000"],
  async redirects() {
    return [
      {
        source: "/graph/diandra/pinned",
        destination: "/demo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
