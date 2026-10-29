import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is database-backed and per-user. Nothing is statically cached.
  cacheComponents: false,
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["pg"],
  experimental: {
    // Health documents are uploaded through Server Actions. The default 1 MB
    // limit is too small for lab PDFs; the application enforces 8 MB per file.
    serverActions: {
      bodySizeLimit: "12mb",
    },
    // O proxy clona o corpo da requisição. O padrão de 10 MB truncava uploads
    // maiores sem devolver erro. A importação do Apple Saúde fica fora do
    // matcher do proxy e tem limite de domínio próprio.
    proxyClientMaxBodySize: "13mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
