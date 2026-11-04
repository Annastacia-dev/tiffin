/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Browsers must check for a new service worker rather than use a cached one
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};
export default nextConfig;
