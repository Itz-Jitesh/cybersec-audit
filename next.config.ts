import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where the build output goes, overridable per invocation.
   *
   * `next dev` and `next build` both own `.next` by default, so running a
   * verification build while a dev server is up deletes the manifests that
   * server is actively reading. The symptom is a burst of ENOENT on
   * build-manifest.json and app-paths-manifest.json and every route 500ing,
   * including /favicon.ico — which looks like application corruption and is
   * really two processes fighting over one directory.
   *
   * Vercel and any plain `pnpm build` are unaffected: with the variable unset
   * this is exactly `.next`. The verification and end-to-end scripts set it to
   * a directory of their own so they can never touch a running dev server.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  /**
   * Nothing needs to be external any more, and that is the point.
   *
   * This used to list isomorphic-dompurify and jsdom, because jsdom reads real
   * files off disk at require time and bundling it rewrote those paths into
   * ones that do not exist. Keeping it external then exposed the other half of
   * the problem: jsdom's CommonJS entry require()s ESM dependencies, which
   * Vercel's module loader refuses outright, so the server sanitiser threw at
   * module scope and took every action importing it down with it. The server
   * sanitiser now parses with htmlparser2 and needs no DOM at all — see
   * src/lib/utils/sanitize-html-server.ts — so jsdom is gone from the tree.
   */

  experimental: {
    /**
     * `radix-ui` and `lucide-react` are barrels: importing one primitive pulls
     * the whole package's module graph into the compilation. In development
     * that is thousands of modules recompiled on every edit, which is most of
     * what makes the dev server feel slow; in production it is dead code the
     * bundler has to prove unreachable. This rewrites each import to the exact
     * submodule it resolves to.
     */
    optimizePackageImports: [
      "radix-ui",
      "lucide-react",
      "date-fns",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },
};

export default nextConfig;
