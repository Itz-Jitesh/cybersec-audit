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

  experimental: {
    /**
     * `radix-ui` and `lucide-react` are barrels: importing one primitive pulls
     * the whole package's module graph into the compilation. In development
     * that is thousands of modules recompiled on every edit, which is most of
     * what makes the dev server feel slow; in production it is dead code the
     * bundler has to prove unreachable. This rewrites each import to the exact
     * submodule it resolves to.
     */
    optimizePackageImports: ["radix-ui", "lucide-react", "date-fns"],
  },
};

export default nextConfig;
