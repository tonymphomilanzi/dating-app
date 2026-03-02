import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AuthFlowProvider } from "./contexts/AuthFlowContext.jsx";

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