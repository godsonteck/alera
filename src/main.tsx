import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { frontendEnv } from "./config/env";

const rootElement = document.getElementById("root");
const clientId = frontendEnv.googleClientId;

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    clientId ? (
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )
  );
} else {
  document.body.innerHTML = '<h1>ERROR: Root element not found</h1>';
}
