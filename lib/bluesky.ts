import { Agent } from '@atproto/api';
import { JoseKey } from '@atproto/jwk-jose';
import { NodeOAuthClient, requestLocalLock, type NodeSavedSession, type NodeSavedState, type OAuthClientMetadataInput } from '@atproto/oauth-client-node';
import { env } from 'cloudflare:workers';
import { createSecureStore } from './secure-store';

export const SITE_ORIGIN = 'https://spiral-comics-postmaster.rrobinson81.chatgpt.site';
export const BLUESKY_CALLBACK = `${SITE_ORIGIN}/api/oauth/bluesky/callback`;
export const BLUESKY_METADATA = `${SITE_ORIGIN}/api/oauth/bluesky/client-metadata.json`;
export const BLUESKY_JWKS = `${SITE_ORIGIN}/api/oauth/bluesky/jwks.json`;

type DidDocument = {
  id: string;
  alsoKnownAs?: string[];
  service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
  verificationMethod?: unknown[];
  [key: string]: unknown;
};

async function resolveBlueskyIdentity(input: string) {
  let did = input;

  if (!input.startsWith('did:')) {
    const handleUrl = new URL('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle');
    handleUrl.searchParams.set('handle', input);
    const handleResponse = await fetch(handleUrl, { headers: { accept: 'application/json' } });
    if (!handleResponse.ok) throw new Error(`Bluesky could not find the account ${input}.`);
    const resolved = await handleResponse.json() as { did?: string };
    if (!resolved.did) throw new Error(`Bluesky did not return an identity for ${input}.`);
    did = resolved.did;
  }

  const didResponse = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, { headers: { accept: 'application/json' } });
  if (!didResponse.ok) throw new Error('Bluesky returned an identity that could not be verified.');
  const didDoc = await didResponse.json() as DidDocument;
  const declaredHandle = didDoc.alsoKnownAs?.find((value) => value.startsWith('at://'))?.slice(5);

  return {
    did: didDoc.id,
    didDoc,
    handle: declaredHandle || input,
  };
}

export const clientMetadata = {
  client_id: BLUESKY_METADATA,
  client_name: 'Postmaster by Spiral Comics',
  client_uri: SITE_ORIGIN,
  logo_uri: `${SITE_ORIGIN}/favicon.svg`,
  redirect_uris: [BLUESKY_CALLBACK] as [string, ...string[]],
  grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
  scope: 'atproto transition:generic',
  response_types: ['code'] as ['code'],
  application_type: 'web',
  token_endpoint_auth_method: 'private_key_jwt' as const,
  token_endpoint_auth_signing_alg: 'ES256' as const,
  dpop_bound_access_tokens: true,
  jwks_uri: BLUESKY_JWKS,
} satisfies OAuthClientMetadataInput;

export async function getBlueskyClient(): Promise<NodeOAuthClient> {
  if (!env.POSTMASTER_OAUTH_PRIVATE_JWK) throw new Error('Bluesky OAuth signing key is unavailable.');
  const signingKey = await JoseKey.fromJWK(env.POSTMASTER_OAUTH_PRIVATE_JWK, 'postmaster-1');
  return new NodeOAuthClient({
    clientMetadata,
    keyset: [signingKey],
    stateStore: createSecureStore<NodeSavedState>('bluesky-state', 900),
    sessionStore: createSecureStore<NodeSavedSession>('bluesky-session'),
    identityResolver: { resolve: resolveBlueskyIdentity },
    requestLock: requestLocalLock,
  });
}

export async function getBlueskyJwks() {
  return (await getBlueskyClient()).jwks;
}

export async function getBlueskyAgent(did: string): Promise<Agent> {
  const session = await (await getBlueskyClient()).restore(did);
  return new Agent(session);
}
