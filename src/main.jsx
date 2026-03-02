import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AuthFlowProvider } from "./contexts/AuthFlowContext.jsx";

// Global error logs (dev only to reduce noise in prod)
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
      reason: (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason),
    });
  });
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthFlowProvider>
          <App />
        </AuthFlowProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);