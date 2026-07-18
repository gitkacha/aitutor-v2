// The identity-provider seam (Milestone 2): routes and middleware depend only on this
// interface, never on how credentials are verified. Swapping to a third-party IdP
// (e.g. Auth0/OIDC) means adding a provider that maps the IdP's subject claim to
// User.providerSubject and wiring its redirect flow — sessions, middleware and every
// domain route stay untouched.

export interface AuthenticatedIdentity {
  userId: number;
}

export interface IdentityProvider {
  // Resolves credentials to a local user id, or null when they don't check out.
  verifyCredentials(email: string, password: string): Promise<AuthenticatedIdentity | null>;
}

import { localProvider } from './local-provider';

export function getIdentityProvider(): IdentityProvider {
  // AUTH_PROVIDER selects the implementation; only 'local' exists today.
  return localProvider;
}
