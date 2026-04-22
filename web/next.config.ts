import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/download",
        destination:
          "https://github.com/mathieuanduze/fragreel-client/releases/latest/download/FragReel.exe",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
