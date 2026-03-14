  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Register PWA service worker only when supported; ignore errors (e.g. user denied permission)
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    import("virtual:pwa-register")
      .then(({ registerSW }) =>
        registerSW({ onRegisterError: () => {} })
      )
      .catch(() => {});
  }

  createRoot(document.getElementById("root")!).render(<App />);
  