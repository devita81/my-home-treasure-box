import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Sentry DSN is publishable by design — safe to hardcode as fallback so
// production captures errors even if VITE_SENTRY_DSN env var is not set.
// Override via VITE_SENTRY_DSN if you need to point at a different project.
const SENTRY_DSN_FALLBACK =
  "https://439645331bad5c72ce8c3ffa03edab7e@o4511342342242305.ingest.us.sentry.io/4511342352924672";
const dsn = import.meta.env.VITE_SENTRY_DSN || SENTRY_DSN_FALLBACK;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance monitoring — 100% sampling, fine for low-traffic app.
    tracesSampleRate: 1.0,
    // Session replay: 10% of normal sessions, 100% of sessions where errors occur.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Tags every event with 'development' or 'production' so dev noise is separable.
    environment: import.meta.env.MODE,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
