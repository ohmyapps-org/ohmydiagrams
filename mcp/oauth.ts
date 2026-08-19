import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js'

/**
 * A minimal OAuth 2.1 authorization server, so Claude.ai / ChatGPT / Gemini /
 * Grok can add this canvas as a remote MCP connector: they discover this
 * server via the well-known endpoints, register themselves (RFC 7591), send
 * the browser here to approve the connection, and exchange the resulting
 * code for a bearer token (RFC 6749 + PKCE).
 *
 * There is exactly one owner and no accounts: "consent" is typing the
 * passphrase set in `OHMYDIAGRAMS_OWNER_TOKEN`. Everything below is
 * unreachable unless that variable is set — this file changes nothing about
 * the app until someone deploying it opts in.
 *
 * All state is in memory, same as the rest of `mcp/`: a restart clears
 * registered clients and tokens, and every connector has to be re-approved.
 * That is an acceptable cost for a single-owner tool and avoids adding a
 * database for it.
 */

const CODE_TTL_MS = 60_000
const ACCESS_TOKEN_TTL_S = 60 * 60
const REFRESH_TOKEN_TTL_S = 90 * 24 * 60 * 60

export interface AccessTokenInfo {
  token: string
  clientId: string
  scopes: string[]
  expiresAt: number
}

interface StoredClient {
  client_id: string
  client_secret?: string
  client_secret_expires_at?: number
  redirect_uris: string[]
  client_name?: string
  token_endpoint_auth_method: string
}

interface StoredCode {
  clientId: string
  codeChallenge: string
  redirectUri: string
  scope: string[]
  expiresAt: number
}

interface StoredToken {
  clientId: string
  scope: string[]
  expiresAt: number
}

interface StoredRefreshToken {
  clientId: string
  scope: string[]
  expiresAt: number
}

const clients = new Map<string, StoredClient>()
const codes = new Map<string, StoredCode>()
const accessTokens = new Map<string, StoredToken>()
const refreshTokens = new Map<string, StoredRefreshToken>()

export function mcpAuthEnabled(): boolean {
  return Boolean(process.env.OHMYDIAGRAMS_OWNER_TOKEN?.trim())
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifyPkce(verifier: string, challenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return timingSafeEqualStr(base64UrlFromBytes(new Uint8Array(digest)), challenge)
}

function checkOwnerPassphrase(candidate: string): boolean {
  const expected = process.env.OHMYDIAGRAMS_OWNER_TOKEN?.trim()
  if (!expected) return false
  return timingSafeEqualStr(candidate, expected)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS, ...extraHeaders },
  })
}

function oauthError(status: number, error: string, description?: string): Response {
  return json({ error, error_description: description }, status)
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/** Verifies a bearer token presented to `/mcp`. Returns `null` if invalid or expired. */
export function verifyAccessToken(token: string): AccessTokenInfo | null {
  const stored = accessTokens.get(token)
  if (!stored) return null
  if (stored.expiresAt < Date.now()) {
    accessTokens.delete(token)
    return null
  }
  return { token, clientId: stored.clientId, scopes: stored.scope, expiresAt: Math.floor(stored.expiresAt / 1000) }
}

function metadata(origin: string) {
  const issuer = origin
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  }
}

function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
  }
}

function consentPage(params: URLSearchParams, error?: string): Response {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope']
    .filter((key) => params.get(key) !== null)
    .map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(params.get(key) ?? '')}">`)
    .join('\n')
  return html(`<!doctype html>
<html><head><meta charset="utf-8"><title>Conectar con Oh My Diagrams</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 24rem; margin: 4rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.1rem; }
  input[type=password] { width: 100%; padding: .5rem; margin: .75rem 0; box-sizing: border-box; }
  button { padding: .5rem 1rem; }
  .error { color: #b3261e; font-size: .9rem; }
</style></head>
<body>
  <h1>Conectar con tu lienzo</h1>
  <p>Un cliente MCP pide acceso a este lienzo. Ingresá la clave del dueño para autorizarlo.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <form method="POST">
    ${hidden}
    <input type="password" name="passphrase" placeholder="Clave" autofocus required>
    <button type="submit">Autorizar</button>
  </form>
</body></html>`)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

async function handleRegister(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return oauthError(400, 'invalid_client_metadata', 'El cuerpo tiene que ser JSON.')
  }
  const parsed = OAuthClientMetadataSchema.safeParse(body)
  if (!parsed.success) return oauthError(400, 'invalid_client_metadata', parsed.error.message)

  const metadata = parsed.data
  const isPublicClient = metadata.token_endpoint_auth_method === 'none'
  const clientId = randomUUID()
  const issuedAt = Math.floor(Date.now() / 1000)
  const client: StoredClient = {
    client_id: clientId,
    client_secret: isPublicClient ? undefined : randomToken(32),
    client_secret_expires_at: isPublicClient ? undefined : issuedAt + 30 * 24 * 60 * 60,
    redirect_uris: metadata.redirect_uris,
    client_name: metadata.client_name,
    token_endpoint_auth_method: metadata.token_endpoint_auth_method ?? 'client_secret_post',
  }
  clients.set(clientId, client)

  return json(
    {
      ...metadata,
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_secret: client.client_secret,
      client_secret_expires_at: client.client_secret_expires_at,
    },
    201,
  )
}

function handleAuthorizeGet(url: URL): Response {
  const clientId = url.searchParams.get('client_id')
  const redirectUri = url.searchParams.get('redirect_uri')
  const responseType = url.searchParams.get('response_type')
  const codeChallenge = url.searchParams.get('code_challenge')
  const codeChallengeMethod = url.searchParams.get('code_challenge_method')

  const client = clientId ? clients.get(clientId) : undefined
  if (!client) return oauthError(400, 'invalid_request', 'client_id desconocido. Registrate primero en /register.')
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return oauthError(400, 'invalid_request', 'redirect_uri no coincide con el registrado.')
  }
  if (responseType !== 'code') return oauthError(400, 'unsupported_response_type', 'Sólo se soporta "code".')
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return oauthError(400, 'invalid_request', 'Falta PKCE (code_challenge con method S256).')
  }
  return consentPage(url.searchParams)
}

async function handleAuthorizePost(request: Request): Promise<Response> {
  const form = new URLSearchParams(await request.text())
  const clientId = form.get('client_id')
  const redirectUri = form.get('redirect_uri')
  const codeChallenge = form.get('code_challenge')
  const state = form.get('state')
  const scope = form.get('scope')
  const passphrase = form.get('passphrase') ?? ''

  const client = clientId ? clients.get(clientId) : undefined
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri) || !codeChallenge) {
    return oauthError(400, 'invalid_request', 'Solicitud de autorización inválida.')
  }

  if (!checkOwnerPassphrase(passphrase)) {
    return consentPage(form, 'Clave incorrecta.')
  }

  const code = randomToken()
  codes.set(code, {
    clientId: client.client_id,
    codeChallenge,
    redirectUri,
    scope: scope ? scope.split(' ') : [],
    expiresAt: Date.now() + CODE_TTL_MS,
  })

  const redirect = new URL(redirectUri)
  redirect.searchParams.set('code', code)
  if (state) redirect.searchParams.set('state', state)
  return Response.redirect(redirect.toString(), 302)
}

function authenticateClient(form: URLSearchParams, authHeader: string | null): StoredClient | undefined {
  let clientId = form.get('client_id') ?? undefined
  let clientSecret = form.get('client_secret') ?? undefined
  if (!clientId && authHeader?.startsWith('Basic ')) {
    const [id, secret] = Buffer.from(authHeader.slice(6), 'base64').toString('utf8').split(':')
    clientId = id
    clientSecret = secret
  }
  if (!clientId) return undefined
  const client = clients.get(clientId)
  if (!client) return undefined
  if (client.client_secret && client.client_secret !== clientSecret) return undefined
  return client
}

async function handleToken(request: Request): Promise<Response> {
  const form = new URLSearchParams(await request.text())
  const grantType = form.get('grant_type')
  const client = authenticateClient(form, request.headers.get('Authorization'))
  if (!client) return oauthError(401, 'invalid_client', 'Cliente desconocido o secreto incorrecto.')

  if (grantType === 'authorization_code') {
    const code = form.get('code')
    const verifier = form.get('code_verifier')
    const stored = code ? codes.get(code) : undefined
    if (!stored || !verifier) return oauthError(400, 'invalid_grant', 'Código inválido.')
    codes.delete(code!)
    if (stored.expiresAt < Date.now() || stored.clientId !== client.client_id) {
      return oauthError(400, 'invalid_grant', 'Código vencido o de otro cliente.')
    }
    if (!(await verifyPkce(verifier, stored.codeChallenge))) {
      return oauthError(400, 'invalid_grant', 'code_verifier no coincide con el challenge.')
    }
    return json(issueTokens(client.client_id, stored.scope))
  }

  if (grantType === 'refresh_token') {
    const refreshToken = form.get('refresh_token')
    const stored = refreshToken ? refreshTokens.get(refreshToken) : undefined
    refreshTokens.delete(refreshToken ?? '')
    if (!stored || stored.clientId !== client.client_id || stored.expiresAt < Date.now()) {
      return oauthError(400, 'invalid_grant', 'Refresh token inválido o vencido.')
    }
    return json(issueTokens(client.client_id, stored.scope))
  }

  return oauthError(400, 'unsupported_grant_type', 'Sólo se soportan authorization_code y refresh_token.')
}

// Rotated on every use: each refresh_token grant issues a new one and
// invalidates the old, so a stolen-but-unused token has a shrinking window.
function issueTokens(clientId: string, scope: string[]) {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  accessTokens.set(accessToken, { clientId, scope, expiresAt: Date.now() + ACCESS_TOKEN_TTL_S * 1000 })
  refreshTokens.set(refreshToken, { clientId, scope, expiresAt: Date.now() + REFRESH_TOKEN_TTL_S * 1000 })
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope: scope.join(' '),
  }
}

/**
 * Entry point for the bridge's fetch handler. Returns `null` for any path
 * that isn't part of the OAuth surface, so the caller can fall through to
 * its other routes.
 */
export async function handleOAuthRoute(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  const origin = url.origin

  if (request.method === 'OPTIONS' && isOAuthPath(url.pathname)) {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (url.pathname === '/.well-known/oauth-authorization-server' && request.method === 'GET') {
    return json(metadata(origin))
  }
  if (
    (url.pathname === '/.well-known/oauth-protected-resource' ||
      url.pathname === '/.well-known/oauth-protected-resource/mcp') &&
    request.method === 'GET'
  ) {
    return json(protectedResourceMetadata(origin))
  }
  if (url.pathname === '/register' && request.method === 'POST') {
    return handleRegister(request)
  }
  if (url.pathname === '/authorize' && request.method === 'GET') {
    return handleAuthorizeGet(url)
  }
  if (url.pathname === '/authorize' && request.method === 'POST') {
    return handleAuthorizePost(request)
  }
  if (url.pathname === '/token' && request.method === 'POST') {
    return handleToken(request)
  }
  return null
}

function isOAuthPath(pathname: string): boolean {
  return (
    pathname === '/register' ||
    pathname === '/authorize' ||
    pathname === '/token' ||
    pathname.startsWith('/.well-known/oauth-')
  )
}
