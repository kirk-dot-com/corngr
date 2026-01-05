import { AuthProviderProps } from "react-oidc-context";

export const oidcConfig: AuthProviderProps = {
    authority: "https://dev-corngr.us.auth0.com", // Placeholder
    client_id: "placeholder-client-id",
    redirect_uri: window.location.origin,
    onSigninCallback: (user) => {
        // Allow redirect after signin
        window.history.replaceState({}, document.title, window.location.pathname);
    }
};
