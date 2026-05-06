import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env including non-VITE_ prefixed vars (the empty prefix '' means "all").
  // Needed because vite.config.ts runs before Vite's normal env loading,
  // and SENTRY_AUTH_TOKEN must NOT have VITE_ prefix (it's a server-side secret).
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      // 'hidden' = generate source maps but don't reference them in the bundle.
      // Sentry uploads them so stack traces de-minify, but they aren't exposed
      // to end users via //# sourceMappingURL= comments.
      sourcemap: "hidden",
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      // Sentry plugin must come AFTER all other plugins. Skips upload if
      // SENTRY_AUTH_TOKEN is not set (e.g. PR CI runs, fresh clones), so
      // it won't break those workflows.
      sentryVitePlugin({
        org: "dv-bo",
        project: "car-collection",
        authToken: env.SENTRY_AUTH_TOKEN,
        // Don't fail the build if upload fails — better to ship without
        // source maps than to break production deploys.
        errorHandler: (err) => {
          // eslint-disable-next-line no-console
          console.warn("Sentry source map upload failed:", err.message);
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
