import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
