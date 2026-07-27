// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import "./index.css";

// ── Global error logging (dev only) ──────────────────────────────
if (import.meta.env.DEV) {
  window.addEventListener("error", (e) => {
    console.error("[GlobalError] window.error", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      error: e.error?.stack || e.error,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("[GlobalError] unhandledrejection", {
      reason:
        e.reason && (e.reason.stack || e.reason.message)
          ? e.reason.stack || e.reason.message
          : String(e.reason),
    });
  });
}

// ── Root element guard ────────────────────────────────────────────
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// ── Render ────────────────────────────────────────────────────────
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />

      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);