// ═══════════════════════════════════════════════════════════════
//  AUTH  –  Anmeldung mit MSAL.js (Authorization Code Flow + PKCE)
//
//  MSAL kommt als globales `msal` über das CDN (siehe index.html).
//  Die Redirect-URI wird aus der aktuellen Adresse abgeleitet, damit der
//  Code nichts über den Hosting-Ort wissen muss. Sie muss in der
//  App-Registrierung exakt so eingetragen sein (z.B. http://localhost:8000/).
// ═══════════════════════════════════════════════════════════════

export function redirectUriFor(href) {
  return new URL('./', href).href;            // ohne index.html, Query und Fragment
}

export async function createAuth({ clientId, authority, scopes }) {
  const msal = window.msal;
  if (!msal) throw new Error('MSAL.js konnte nicht geladen werden.');

  const redirectUri = redirectUriFor(location.href);
  const pca = new msal.PublicClientApplication({
    auth: { clientId, authority, redirectUri, postLogoutRedirectUri: redirectUri },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();

  const result = await pca.handleRedirectPromise();
  if (result?.account) {
    pca.setActiveAccount(result.account);
  } else if (!pca.getActiveAccount() && pca.getAllAccounts().length > 0) {
    pca.setActiveAccount(pca.getAllAccounts()[0]);
  }

  return {
    get account() {
      return pca.getActiveAccount();
    },

    login() {
      return pca.loginRedirect({ scopes, prompt: 'select_account' });
    },

    logout() {
      return pca.logoutRedirect({ account: pca.getActiveAccount() });
    },

    // Erst still versuchen, sonst Redirect zur Anmeldung
    async getToken() {
      const account = pca.getActiveAccount();
      if (!account) throw new Error('Nicht angemeldet.');
      try {
        const res = await pca.acquireTokenSilent({ scopes, account });
        return res.accessToken;
      } catch (err) {
        if (err instanceof msal.InteractionRequiredAuthError) {
          await pca.acquireTokenRedirect({ scopes, account });
          return new Promise(() => {});        // Seite wird umgeleitet
        }
        throw err;
      }
    },
  };
}
