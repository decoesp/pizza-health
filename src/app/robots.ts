import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/entrar", "/criar-conta", "/privacidade", "/termos", "/seguranca"],
        disallow: [
          "/inicio",
          "/comunidade",
          "/habitos",
          "/exames",
          "/vacinas",
          "/desafios",
          "/ranking",
          "/perfil",
          "/notificacoes",
          "/admin",
          "/api/",
          "/convite/",
          "/redefinir/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
