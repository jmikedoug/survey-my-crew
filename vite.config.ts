// SELF-HOST replacement for the root vite.config.ts.
// The Lovable config package (@lovable.dev/vite-tanstack-config) bundles these
// plugins plus sandbox-only behaviour; this composes them directly.
//
// Also remove from package.json: @lovable.dev/vite-tanstack-config,
// @lovable.dev/cloud-auth-js, @lovable.dev/mcp-js  (see README).
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    // preset: "vercel" | "netlify" | "node-server"
    nitro({ config: { preset: process.env.NITRO_PRESET || "vercel" } }),
  ],
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 8080 },
});
