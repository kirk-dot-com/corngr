import React from "react";
import ReactDOM from "react-dom/client";
import { DemoApp } from "./DemoApp";

import { AuthProvider } from "react-oidc-context";
import { oidcConfig } from "./security/OidcConfig";
import { CorngrAuthProvider } from "./security/CorngrAuthProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <CorngrAuthProvider>
        <DemoApp />
      </CorngrAuthProvider>
    </AuthProvider>
  </React.StrictMode>,
);
