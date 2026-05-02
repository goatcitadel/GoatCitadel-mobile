/**
 * GoatCitadel Mobile — Gateway API Client
 */
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as ExpoCrypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import type {
    DashboardState,
    SystemVitals,
    ChatAttachmentRecord,
    ChatSessionRecord,
    ChatSpecialistCandidatePatchInput,
    ChatSpecialistCandidateRecord,
    ChatSpecialistCandidateSuggestionRecord,
    ChatThreadResponse,
    ChatSendMessageRequest,
    ChatSendMessageResponse,
    ChatCancelTurnResponse,
    ChatMessageRecord,
    ChatSessionPrefsRecord,
    ApprovalRequest,
    AgentProfileRecord,
    LlmModelRecord,
    RuntimeSettings,
    SkillListItem,
    SkillRuntimeState,
    McpServerRecord,
    CronJobRecord,
    GatewayAccessPreflightResult,
    GatewayConnectionCheck,
    GatewayAuthMode,
    RealtimeEvent,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestStatusResponse,
    CompanionSessionExchangeInput,
    CompanionSessionExchangeResponse,
    CompanionSessionInfoResponse,
    CompanionSessionRefreshResponse,
    FollowOnParityReport,
    FollowOnProofLaneArtifactRecord,
} from './types';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../utils/storage';

let gatewayBaseUrl = '';
let authToken: string | undefined;
let companionSession: PersistedCompanionSession | undefined;
let companionRefreshInFlight: Promise<PersistedCompanionSession> | undefined;
let lastCompanionBootstrapError: string | undefined;
const STORE_KEY_URL = 'gc_gateway_url';
const STORE_KEY_TOKEN = 'gc_auth_token';
const STORE_KEY_COMPANION_SESSION = 'gc_companion_session';
const GATEWAY_HEALTH_PATH = '/health';
const GATEWAY_AUTH_PROBE_PATH = '/api/v1/sessions?limit=1';
const GATEWAY_PROBE_TIMEOUT_MS = 5000;
const GATEWAY_REQUEST_TIMEOUT_MS = 20000;
const GATEWAY_CHAT_REQUEST_TIMEOUT_MS = 180000;
const GATEWAY_THREAD_REQUEST_TIMEOUT_MS = 20000;
const COMPANION_REFRESH_SKEW_MS = 30_000;
const COMPANION_PUBLIC_KEY_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface PersistedCompanionSession extends CompanionSessionExchangeResponse {
    signingPublicKeyPem: string;
    signingPrivateKeyBase64: string;
    clientName?: string;
    appVersion?: string;
}

type AndroidGatewayHttpResult = {
    url?: string;
    host?: string;
    status?: number;
    body?: string;
    errorClass?: string;
    errorMessage?: string;
    cleartextPermitted?: boolean;
    cleartextPermittedForHost?: boolean;
    activeNetwork?: string;
    resolvedAddresses?: string[];
};

type AndroidPingResult = {
    ok?: boolean;
    module?: string;
    cleartextPermitted?: boolean;
    activeNetwork?: string;
};

type GatewayHttpNativeModule = {
    ping: () => Promise<AndroidPingResult>;
    request: (
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string | null,
        timeoutMs: number,
    ) => Promise<AndroidGatewayHttpResult>;
    streamRequest?: (
        streamId: string,
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string | null,
        timeoutMs: number,
    ) => Promise<AndroidGatewayHttpResult>;
    cancelStream?: (streamId: string) => void;
    addListener?: (eventName: string) => void;
    removeListeners?: (count: number) => void;
};

/** Cached result so we only probe once per session. */
let _nativeModuleProbeResult: { available: boolean; detail: string } | undefined;

function getRawAndroidModule(): GatewayHttpNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }
    const mod = (NativeModules as Record<string, unknown>).GatewayHttp;
    if (!mod || typeof mod !== 'object') {
        return undefined;
    }
    // In New Architecture interop, methods may be lazily initialised.
    // Accept the module if it exists as an object — we'll verify it works
    // via ping() at runtime rather than checking typeof on each method.
    return mod as GatewayHttpNativeModule;
}

export function getAndroidGatewayHttpModule(): GatewayHttpNativeModule | undefined {
    if (_nativeModuleProbeResult?.available === false) {
        return undefined;
    }
    return getRawAndroidModule();
}

/**
 * Probe whether the native GatewayHttp module is usable.  Returns a
 * human-readable diagnostic string.  The result is cached for the session.
 */
async function probeNativeModule(): Promise<{ available: boolean; detail: string }> {
    if (_nativeModuleProbeResult) {
        return _nativeModuleProbeResult;
    }

    if (Platform.OS !== 'android') {
        _nativeModuleProbeResult = { available: false, detail: 'not Android' };
        return _nativeModuleProbeResult;
    }

    const mod = getRawAndroidModule();
    if (!mod) {
        const keys = Object.keys(NativeModules).sort().join(', ');
        _nativeModuleProbeResult = {
            available: false,
            detail: `NativeModules.GatewayHttp is ${String((NativeModules as Record<string, unknown>).GatewayHttp)}. Available modules: ${keys || '(none)'}`,
        };
        return _nativeModuleProbeResult;
    }

    if (typeof mod.ping !== 'function') {
        _nativeModuleProbeResult = {
            available: false,
            detail: `GatewayHttp found but ping is ${typeof mod.ping} (expected function). Keys: ${Object.keys(mod).join(', ')}`,
        };
        return _nativeModuleProbeResult;
    }

    try {
        const ping = await withTimeout(mod.ping(), 3000);
        _nativeModuleProbeResult = {
            available: ping.ok === true,
            detail: `ping ok=${String(ping.ok)} cleartext=${String(ping.cleartextPermitted)} net=${ping.activeNetwork ?? '?'}`,
        };
    } catch (error) {
        _nativeModuleProbeResult = {
            available: false,
            detail: `ping threw: ${(error as Error).message}`,
        };
    }
    return _nativeModuleProbeResult;
}

/** Race a promise against a timeout — rejects with a clear message if the timeout fires first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error(`Timed out after ${ms}ms`));
            }
        }, ms);
        promise.then(
            (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
            (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } },
        );
    });
}

class GatewayApiError extends Error {
    kind: 'api' | 'network';
    status?: number;
    body?: unknown;
    authMode?: GatewayAuthMode;

    constructor(
        message: string,
        options: {
            kind: 'api' | 'network';
            status?: number;
            body?: unknown;
            authMode?: GatewayAuthMode;
        },
    ) {
        super(message);
        this.name = 'GatewayApiError';
        this.kind = options.kind;
        this.status = options.status;
        this.body = options.body;
        this.authMode = options.authMode;
    }
}

export function isGatewayAuthFailure(error: unknown): boolean {
    if (error instanceof GatewayApiError) {
        return error.status === 401 || error.status === 403;
    }
    const normalized = (error as Error | undefined)?.message?.toLowerCase() ?? '';
    return normalized.includes('401')
        || normalized.includes('403')
        || normalized.includes('credentials are required')
        || normalized.includes('unauthorized')
        || normalized.includes('forbidden');
}

export function setGatewayUrl(url: string) {
    gatewayBaseUrl = url.trim().replace(/\/+$/, '');
}

export function setAuthToken(token: string | undefined) {
    authToken = token?.trim() || undefined;
}

export function setCompanionSession(session: PersistedCompanionSession | undefined) {
    companionSession = session;
    if (session) {
        authToken = undefined;
        lastCompanionBootstrapError = undefined;
    }
}

export function getAuthToken() {
    return authToken;
}

export function getGatewayUrl() {
    return gatewayBaseUrl;
}

export function getCompanionSession() {
    return companionSession;
}

export function getLastCompanionBootstrapError() {
    return lastCompanionBootstrapError;
}

function getDefaultCompanionClientName(): string {
    const configuredName = typeof Constants.expoConfig?.name === 'string'
        ? Constants.expoConfig.name.trim()
        : '';
    return configuredName || 'GoatCitadel Mobile';
}

function getDefaultCompanionAppVersion(): string | undefined {
    const configuredVersion = typeof Constants.expoConfig?.version === 'string'
        ? Constants.expoConfig.version.trim()
        : '';
    return configuredVersion || undefined;
}

export async function initializeStoredGatewayAccess(): Promise<{
    gatewayUrl: string;
    authToken?: string;
    companionSession?: PersistedCompanionSession;
}> {
    const storedUrl = await getSecureItem(STORE_KEY_URL);
    const storedToken = await getSecureItem(STORE_KEY_TOKEN);
    const storedCompanionSession = await getSecureItem(STORE_KEY_COMPANION_SESSION);
    const nextUrl = gatewayBaseUrl.trim() || storedUrl?.trim() || '';
    let parsedCompanionSession: PersistedCompanionSession | undefined;
    if (storedCompanionSession?.trim()) {
        try {
            parsedCompanionSession = JSON.parse(storedCompanionSession) as PersistedCompanionSession;
        } catch {
            await deleteSecureItem(STORE_KEY_COMPANION_SESSION);
        }
    }
    setGatewayUrl(nextUrl);
    setCompanionSession(parsedCompanionSession);
    setAuthToken(parsedCompanionSession ? undefined : storedToken || undefined);
    return {
        gatewayUrl: nextUrl,
        authToken: parsedCompanionSession ? undefined : (storedToken?.trim() || undefined),
        companionSession: parsedCompanionSession,
    };
}

export async function persistGatewayAccessState(input: {
    gatewayUrl: string;
    authToken?: string;
    companionSession?: PersistedCompanionSession;
}): Promise<void> {
    await setSecureItem(STORE_KEY_URL, input.gatewayUrl);
    if (input.companionSession) {
        await setSecureItem(STORE_KEY_COMPANION_SESSION, JSON.stringify(input.companionSession));
        await deleteSecureItem(STORE_KEY_TOKEN);
        return;
    }
    await deleteSecureItem(STORE_KEY_COMPANION_SESSION);
    if (input.authToken?.trim()) {
        await setSecureItem(STORE_KEY_TOKEN, input.authToken.trim());
    } else {
        await deleteSecureItem(STORE_KEY_TOKEN);
    }
}

function authHeaders(): Record<string, string> {
    const bearer = companionSession?.accessToken || authToken;
    if (!bearer) return {};
    return {
        Authorization: `Bearer ${bearer}`,
        ...(companionSession ? {} : { 'x-goatcitadel-token': bearer }),
    };
}

export function getGatewayAuthHeaders(): Record<string, string> {
    return authHeaders();
}

function unwrap<T>(payload: unknown): T {
    if (
        payload &&
        typeof payload === 'object' &&
        'data' in payload &&
        ('success' in payload || 'meta' in payload)
    ) {
        return (payload as { data: T }).data;
    }
    return payload as T;
}

function parseErrorBody(text: string): unknown {
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

function readApiErrorMessage(body: unknown): string | undefined {
    if (typeof body === 'string') {
        return body;
    }
    if (body && typeof body === 'object' && 'error' in body) {
        const value = (body as { error?: unknown }).error;
        if (typeof value === 'string') {
            return value;
        }
    }
    return undefined;
}

function normalizeAuthMode(body: unknown): GatewayAuthMode | undefined {
    if (!body || typeof body !== 'object' || !('authMode' in body)) {
        return undefined;
    }
    const value = (body as { authMode?: unknown }).authMode;
    if (value === 'none' || value === 'token' || value === 'basic') {
        return value;
    }
    return undefined;
}

function isCompanionSignedMutationMethod(method: string): boolean {
    const normalized = method.trim().toUpperCase();
    return normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH' || normalized === 'DELETE';
}

function shouldRefreshCompanionSession(session: PersistedCompanionSession): boolean {
    const expiresAt = Date.parse(session.accessTokenExpiresAt);
    if (!Number.isFinite(expiresAt)) {
        return true;
    }
    return expiresAt - Date.now() <= COMPANION_REFRESH_SKEW_MS;
}

function normalizeCompanionRequestPath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) {
        return '/';
    }
    return trimmed.split('?', 1)[0] || '/';
}

function sortCompanionJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sortCompanionJsonValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort((left, right) => left.localeCompare(right))
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortCompanionJsonValue((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }
    return value;
}

function canonicalizeCompanionBody(body: unknown): string {
    if (body === undefined) {
        return '';
    }
    return JSON.stringify(sortCompanionJsonValue(body));
}

function stringifyPemBlock(label: string, bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    const wrapped = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
    return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

function toBase64Url(buffer: Uint8Array): string {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function createCompanionSigningMaterial(): Promise<{
    signingPublicKeyPem: string;
    signingPrivateKeyBase64: string;
}> {
    // React Native/Hermes release builds do not provide tweetnacl's default
    // PRNG hook reliably, so derive the Ed25519 keypair from ExpoCrypto bytes.
    const seed = Uint8Array.from(ExpoCrypto.getRandomBytes(32));
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    const publicKeyDer = new Uint8Array(COMPANION_PUBLIC_KEY_SPKI_PREFIX.length + keyPair.publicKey.length);
    publicKeyDer.set(COMPANION_PUBLIC_KEY_SPKI_PREFIX, 0);
    publicKeyDer.set(keyPair.publicKey, COMPANION_PUBLIC_KEY_SPKI_PREFIX.length);
    return {
        signingPublicKeyPem: stringifyPemBlock('PUBLIC KEY', publicKeyDer),
        signingPrivateKeyBase64: Buffer.from(keyPair.secretKey).toString('base64'),
    };
}

async function buildCompanionSignatureHeaders(
    method: string,
    path: string,
    body: string | undefined,
): Promise<Record<string, string>> {
    if (!companionSession) {
        return {};
    }
    const timestamp = new Date().toISOString();
    const nonce = toBase64Url(ExpoCrypto.getRandomBytes(18));
    let parsedBody: unknown = undefined;
    if (body && body.trim()) {
        try {
            parsedBody = JSON.parse(body);
        } catch {
            parsedBody = body;
        }
    }
    const canonicalBody = canonicalizeCompanionBody(parsedBody);
    const bodyHash = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        canonicalBody,
        { encoding: ExpoCrypto.CryptoEncoding.HEX },
    );
    const payload = `${method.trim().toUpperCase()}\n${normalizeCompanionRequestPath(path)}\n${timestamp}\n${nonce}\n${bodyHash}`;
    const secretKey = Uint8Array.from(Buffer.from(companionSession.signingPrivateKeyBase64, 'base64'));
    const signature = nacl.sign.detached(Buffer.from(payload, 'utf8'), secretKey);
    return {
        'x-goatcitadel-companion-timestamp': timestamp,
        'x-goatcitadel-companion-nonce': nonce,
        'x-goatcitadel-companion-signature': toBase64Url(signature),
    };
}

async function persistCurrentGatewayAccess(): Promise<void> {
    await persistGatewayAccessState({
        gatewayUrl: gatewayBaseUrl,
        authToken,
        companionSession,
    });
}

async function refreshCompanionSessionInternal(refreshToken: string): Promise<CompanionSessionRefreshResponse> {
    const payload = JSON.stringify({ refreshToken });
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const targetUrl = buildGatewayUrl('/api/v1/auth/companion/session/refresh');
    const nativeResult = await androidNativeRequest('POST', targetUrl, headers, payload, GATEWAY_REQUEST_TIMEOUT_MS);
    if (nativeResult) {
        const status = nativeResult.status ?? -1;
        if (status <= 0) {
            const diagnostics = formatAndroidGatewayDiagnostics(nativeResult);
            throw new GatewayApiError(
                `Network error: ${diagnostics || nativeResult.errorMessage || 'Native Android request failed'}`,
                { kind: 'network' },
            );
        }
        if (status < 200 || status >= 300) {
            const responseBody = parseErrorBody(nativeResult.body ?? '');
            throw new GatewayApiError(
                readApiErrorMessage(responseBody) || `API error ${status}`,
                {
                    kind: 'api',
                    status,
                    body: responseBody,
                    authMode: normalizeAuthMode(responseBody),
                },
            );
        }
        const text = nativeResult.body?.trim() ?? '';
        return unwrap<CompanionSessionRefreshResponse>(JSON.parse(text) as unknown);
    }

    const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: payload,
    });
    if (!response.ok) {
        const text = await response.text();
        const parsedBody = parseErrorBody(text);
        throw new GatewayApiError(
            readApiErrorMessage(parsedBody) || `API error ${response.status}`,
            {
                kind: 'api',
                status: response.status,
                body: parsedBody,
                authMode: normalizeAuthMode(parsedBody),
            },
        );
    }
    return unwrap<CompanionSessionRefreshResponse>(await response.json() as unknown);
}

async function ensureCompanionSessionReady(): Promise<void> {
    if (!companionSession || !shouldRefreshCompanionSession(companionSession)) {
        return;
    }
    if (!companionRefreshInFlight) {
        companionRefreshInFlight = (async () => {
            if (!companionSession) {
                throw new Error('Companion session is not available.');
            }
            const refreshed = await refreshCompanionSessionInternal(companionSession.refreshToken);
            const nextSession: PersistedCompanionSession = {
                ...companionSession,
                ...refreshed,
            };
            setCompanionSession(nextSession);
            await persistCurrentGatewayAccess();
            return nextSession;
        })().finally(() => {
            companionRefreshInFlight = undefined;
        });
    }
    try {
        await companionRefreshInFlight;
    } catch (error) {
        setCompanionSession(undefined);
        await persistCurrentGatewayAccess();
        throw error;
    }
}

export async function clearGatewayAccessState(): Promise<void> {
    setCompanionSession(undefined);
    setAuthToken(undefined);
    lastCompanionBootstrapError = undefined;
    await persistCurrentGatewayAccess();
}

export async function exchangeCompanionSessionFromApprovedDevice(
    deviceToken: string,
    input?: Partial<CompanionSessionExchangeInput>,
): Promise<PersistedCompanionSession> {
    const trimmedDeviceToken = deviceToken.trim();
    if (!trimmedDeviceToken) {
        throw new Error('A device token is required before exchanging a companion session.');
    }

    const signingMaterial = await createCompanionSigningMaterial();
    const clientName = input?.clientName?.trim() || getDefaultCompanionClientName();
    const appVersion = input?.appVersion?.trim() || getDefaultCompanionAppVersion();
    const previousToken = authToken;
    const previousSession = companionSession;

    setCompanionSession(undefined);
    setAuthToken(trimmedDeviceToken);

    try {
        const response = await request<CompanionSessionExchangeResponse>('/api/v1/auth/companion/session/exchange', {
            method: 'POST',
            body: JSON.stringify({
                signingPublicKeyPem: signingMaterial.signingPublicKeyPem,
                clientName,
                ...(appVersion ? { appVersion } : {}),
            } satisfies CompanionSessionExchangeInput),
        });
        const nextSession: PersistedCompanionSession = {
            ...response,
            ...signingMaterial,
            clientName,
            appVersion,
        };
        setCompanionSession(nextSession);
        setAuthToken(undefined);
        lastCompanionBootstrapError = undefined;
        await persistCurrentGatewayAccess();
        return nextSession;
    } catch (error) {
        lastCompanionBootstrapError = (error as Error).message || 'Companion session bootstrap failed.';
        setCompanionSession(previousSession);
        setAuthToken(previousSession ? undefined : previousToken);
        await persistCurrentGatewayAccess();
        throw error;
    }
}

export function fetchCompanionSessionInfo(): Promise<CompanionSessionInfoResponse> {
    return request('/api/v1/auth/companion/session');
}

function buildGatewayUrl(path: string): string {
    if (!gatewayBaseUrl.trim()) {
        throw new GatewayApiError(
            'Gateway URL is not configured yet. Enter your gateway URL first.',
            { kind: 'network' },
        );
    }
    return `${gatewayBaseUrl}${path}`;
}

function isCleartextBlockDetail(detail: string | undefined): boolean {
    if (!detail) {
        return false;
    }
    const lower = detail.toLowerCase();
    return lower.includes('cleartext')
        || lower.includes('network security')
        || lower.includes('not permitted');
}

function createAbortError(): Error {
    const error = new Error('The request was aborted.');
    error.name = 'AbortError';
    return error;
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) {
        return promise;
    }
    if (signal.aborted) {
        return Promise.reject(createAbortError());
    }

    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const onAbort = () => {
            if (settled) {
                return;
            }
            settled = true;
            reject(createAbortError());
        };

        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                signal.removeEventListener('abort', onAbort);
                reject(error);
            },
        );
    });
}

function normalizeAbortSignal(signal: AbortSignal | null | undefined): AbortSignal | undefined {
    return signal ?? undefined;
}

function formatAndroidGatewayDiagnostics(result: AndroidGatewayHttpResult): string {
    const details: string[] = [];
    if (result.errorClass || result.errorMessage) {
        details.push(
            [result.errorClass, result.errorMessage].filter(Boolean).join(': '),
        );
    }
    if (typeof result.cleartextPermittedForHost === 'boolean') {
        details.push(`cleartext(host)=${String(result.cleartextPermittedForHost)}`);
    }
    if (typeof result.cleartextPermitted === 'boolean') {
        details.push(`cleartext(app)=${String(result.cleartextPermitted)}`);
    }
    if (result.activeNetwork) {
        details.push(`network=${result.activeNetwork}`);
    }
    if (result.resolvedAddresses?.length) {
        details.push(`resolved=${result.resolvedAddresses.join(', ')}`);
    }
    return details.join(' | ');
}

function formatRequestTarget(targetUrl: string): string {
    try {
        const parsed = new URL(targetUrl);
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return targetUrl;
    }
}

async function androidNativeRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string | null,
    timeoutMs = GATEWAY_REQUEST_TIMEOUT_MS,
    signal?: AbortSignal,
): Promise<AndroidGatewayHttpResult | undefined> {
    const module = getAndroidGatewayHttpModule();
    if (!module) {
        return undefined;
    }
    // Wrap with a JS-level timeout that's slightly longer than the native
    // timeout, so we never hang if the native Promise doesn't resolve.
    const jsTimeout = timeoutMs + 3000;
    return withAbortSignal(
        withTimeout(
            module.request(method, url, headers, body ?? null, timeoutMs),
            jsTimeout,
        ),
        signal,
    );
}

function formatGatewayChecks(checks: GatewayConnectionCheck[]): string {
    return checks
        .map((check) => `${check.label}: ${check.status} (${check.path})${check.detail ? ` — ${check.detail}` : ''}`)
        .join('\n');
}

async function runGatewayProbe(
    path: string,
    label: string,
    includeAuth: boolean,
    id: GatewayConnectionCheck['id'],
): Promise<{ check: GatewayConnectionCheck; authMode?: GatewayAuthMode }> {
    const targetUrl = buildGatewayUrl(path);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        const nativeResult = await androidNativeRequest(
            'GET',
            targetUrl,
            includeAuth ? authHeaders() : {},
            null,
            GATEWAY_PROBE_TIMEOUT_MS,
        );

        if (nativeResult) {
            const status = nativeResult.status ?? -1;
            if (status >= 200 && status < 300) {
                return {
                    check: {
                        id,
                        label,
                        path: targetUrl,
                        status: 'success',
                        detail: nativeResult.body?.trim() ? nativeResult.body.trim().slice(0, 200) : 'success',
                        statusCode: status,
                    },
                };
            }

            if (status > 0) {
                const body = parseErrorBody(nativeResult.body ?? '');
                const authMode = normalizeAuthMode(body);
                const apiMessage = readApiErrorMessage(body);
                return {
                    check: {
                        id,
                        label,
                        path: targetUrl,
                        status: status === 401 || status === 403 ? '401' : 'http-error',
                        detail: apiMessage ? `HTTP ${status} ${apiMessage}` : `HTTP ${status}`,
                        statusCode: status,
                    },
                    authMode,
                };
            }

            const detail = formatAndroidGatewayDiagnostics(nativeResult) || nativeResult.errorMessage || 'Native Android request failed';
            const lower = detail.toLowerCase();
            return {
                check: {
                    id,
                    label,
                    path: targetUrl,
                    status: lower.includes('timed out') ? 'timeout' : 'transport-blocked',
                    detail,
                },
            };
        }

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), GATEWAY_PROBE_TIMEOUT_MS);
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: includeAuth ? authHeaders() : undefined,
            signal: controller.signal,
        });

        // P1-12: Always clear the timeout to prevent leaks on non-OK responses.
        clearTimeout(timeoutId);

        if (response.ok) {
            return {
                check: {
                    id,
                    label,
                    path: targetUrl,
                    status: 'success',
                    detail: 'success',
                    statusCode: response.status,
                },
            };
        }

        const text = await response.text();
        const body = parseErrorBody(text);
        const authMode = normalizeAuthMode(body);
        const apiMessage = readApiErrorMessage(body);
        return {
            check: {
                id,
                label,
                path: targetUrl,
                status: response.status === 401 || response.status === 403 ? '401' : 'http-error',
                detail: apiMessage ? `HTTP ${response.status} ${apiMessage}` : `HTTP ${response.status}`,
                statusCode: response.status,
            },
            authMode,
        };
    } catch (error) {
        // Clear the probe timeout on any thrown error to prevent timer leaks.
        clearTimeout(timeoutId);

        if ((error as Error).name === 'AbortError') {
            return {
                check: {
                    id,
                    label,
                    path: targetUrl,
                    status: 'timeout',
                    detail: `Request timed out after ${GATEWAY_PROBE_TIMEOUT_MS / 1000}s`,
                },
            };
        }

        const message = (error as Error).message || 'Network request failed';
        const lower = message.toLowerCase();
        return {
            check: {
                id,
                label,
                path: targetUrl,
                status: lower.includes('timeout') || lower.includes('timed out') ? 'timeout' : 'transport-blocked',
                detail: lower.includes('cleartext')
                    || lower.includes('network security')
                    || lower.includes('not permitted')
                    ? 'Cleartext HTTP was blocked by Android network security.'
                    : message,
                },
            };
    }
}

type GatewayRequestInit = RequestInit & {
    timeoutMs?: number;
};

async function request<T>(path: string, init?: GatewayRequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    const timeoutMs = init?.timeoutMs ?? GATEWAY_REQUEST_TIMEOUT_MS;
    const body = typeof init?.body === 'string' ? init.body : undefined;

    if (companionSession) {
        await ensureCompanionSessionReady();
    }

    const companionSignatureHeaders = companionSession && isCompanionSignedMutationMethod(method)
        ? await buildCompanionSignatureHeaders(method, path, body)
        : {};
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(method !== 'GET' ? { 'Idempotency-Key': createIdempotencyKey() } : {}),
        ...(init?.headers as Record<string, string> ?? {}),
        ...companionSignatureHeaders,
    };

    const targetUrl = buildGatewayUrl(path);
    const nativeResult = await androidNativeRequest(
        method,
        targetUrl,
        headers,
        body,
        timeoutMs,
        normalizeAbortSignal(init?.signal),
    );

    if (nativeResult) {
        const status = nativeResult.status ?? -1;
        if (status <= 0) {
            const requestTarget = formatRequestTarget(targetUrl);
            const requestLabel = `${method.toUpperCase()} ${requestTarget} timeout=${timeoutMs}ms`;
            const diagnostics = formatAndroidGatewayDiagnostics(nativeResult);
            throw new GatewayApiError(
                `Network error: ${[diagnostics || nativeResult.errorMessage || 'Native Android request failed', requestLabel].filter(Boolean).join(' | ')}`,
                { kind: 'network' },
            );
        }

        if (status < 200 || status >= 300) {
            const responseBody = parseErrorBody(nativeResult.body ?? '');
            throw new GatewayApiError(
                readApiErrorMessage(responseBody) || `API error ${status}`,
                {
                    kind: 'api',
                    status,
                    body: responseBody,
                    authMode: normalizeAuthMode(responseBody),
                },
            );
        }

        const text = nativeResult.body?.trim() ?? '';
        if (!text) {
            return undefined as T;
        }
        return unwrap<T>(JSON.parse(text) as unknown);
    }

    let res: Response;
    try {
        res = await fetch(targetUrl, {
            ...init,
            headers,
        });
    } catch (error) {
        throw new GatewayApiError(
            `Network error: ${(error as Error).message}`,
            { kind: 'network' },
        );
    }

    if (!res.ok) {
        const text = await res.text();
        const body = parseErrorBody(text);
        throw new GatewayApiError(
            readApiErrorMessage(body) || `API error ${res.status}`,
            {
                kind: 'api',
                status: res.status,
                body,
                authMode: normalizeAuthMode(body),
            },
        );
    }
    const text = await res.text();
    if (!text) {
        return undefined as T;
    }
    return unwrap<T>(JSON.parse(text) as unknown);
}

export function createIdempotencyKey(): string {
    const bytes = Uint8Array.from(ExpoCrypto.getRandomBytes(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ─── Dashboard ───────────────────────────────────
export function fetchDashboard(): Promise<DashboardState> {
    return request('/api/v1/dashboard/state');
}

export function fetchSystemVitals(): Promise<SystemVitals> {
    return request('/api/v1/system/vitals');
}

export function fetchFollowOnParityReport(): Promise<FollowOnParityReport> {
    return request('/api/v1/system/follow-on-parity');
}

export function exportA2UIProofLane(): Promise<FollowOnProofLaneArtifactRecord> {
    return request('/api/v1/system/follow-on-parity/a2ui-proof-lane/export', {
        method: 'POST',
        body: '{}',
    });
}

export function exportBrowserProofLane(): Promise<FollowOnProofLaneArtifactRecord> {
    return request('/api/v1/system/follow-on-parity/browser-proof-lane/export', {
        method: 'POST',
        body: '{}',
    });
}

export function exportVoiceProofLane(): Promise<FollowOnProofLaneArtifactRecord> {
    return request('/api/v1/system/follow-on-parity/voice-proof-lane/export', {
        method: 'POST',
        body: '{}',
    });
}

export function exportCompanionBootstrapBrief(): Promise<FollowOnProofLaneArtifactRecord> {
    return request('/api/v1/system/follow-on-parity/companion-bootstrap-brief/export', {
        method: 'POST',
        body: '{}',
    });
}

export function exportExtensionSdkBrief(): Promise<FollowOnProofLaneArtifactRecord> {
    return request('/api/v1/system/follow-on-parity/extension-sdk-brief/export', {
        method: 'POST',
        body: '{}',
    });
}

export function fetchRealtimeEvents(options?: {
    limit?: number;
    cursor?: string;
}): Promise<{ items: RealtimeEvent[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options?.limit) {
        params.set('limit', String(options.limit));
    }
    if (options?.cursor?.trim()) {
        params.set('cursor', options.cursor.trim());
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request(`/api/v1/events${suffix}`);
}

// ─── Chat Sessions ───────────────────────────────
export function fetchChatSessions(): Promise<{ items: ChatSessionRecord[] }> {
    return request('/api/v1/chat/sessions?limit=80');
}

function chatSessionPath(sessionId: string, suffix = ''): string {
    return `/api/v1/chat/sessions/${encodeURIComponent(sessionId)}${suffix}`;
}

export function fetchChatThread(
    sessionId: string,
    options?: { timeoutMs?: number },
): Promise<ChatThreadResponse> {
    return request(chatSessionPath(sessionId, '/thread'), {
        timeoutMs: options?.timeoutMs ?? GATEWAY_THREAD_REQUEST_TIMEOUT_MS,
    });
}

export function fetchChatPrefs(sessionId: string): Promise<ChatSessionPrefsRecord> {
    return request(chatSessionPath(sessionId, '/prefs'));
}

export function fetchChatSpecialistCandidates(
    sessionId: string,
): Promise<{ items: ChatSpecialistCandidateRecord[] }> {
    return request(chatSessionPath(sessionId, '/specialist-candidates'));
}

export function sendChatMessage(
    sessionId: string,
    body: ChatSendMessageRequest,
    options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ChatSendMessageResponse> {
    return request(chatSessionPath(sessionId, '/agent-send'), {
        method: 'POST',
        body: JSON.stringify(body),
        signal: options?.signal,
        timeoutMs: options?.timeoutMs ?? GATEWAY_CHAT_REQUEST_TIMEOUT_MS,
    });
}

export function cancelChatTurn(
    sessionId: string,
    turnId: string,
    cancelledBy?: string,
): Promise<ChatCancelTurnResponse> {
    return request(chatSessionPath(sessionId, `/turns/${encodeURIComponent(turnId)}/cancel`), {
        method: 'POST',
        body: JSON.stringify(cancelledBy ? { cancelledBy } : {}),
        timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS,
    });
}

export function uploadChatAttachment(body: {
    sessionId: string;
    projectId?: string;
    fileName: string;
    mimeType: string;
    bytesBase64: string;
}): Promise<ChatAttachmentRecord> {
    return request('/api/v1/chat/attachments', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function createChatSession(): Promise<ChatSessionRecord> {
    return request('/api/v1/chat/sessions', { method: 'POST', body: '{}' });
}

export function deleteChatSession(sessionId: string): Promise<void> {
    return request(chatSessionPath(sessionId), { method: 'DELETE' });
}

export function updateChatPrefs(
    sessionId: string,
    prefs: Partial<ChatSessionPrefsRecord>,
): Promise<ChatSessionPrefsRecord> {
    return request(chatSessionPath(sessionId, '/prefs'), {
        method: 'PATCH',
        body: JSON.stringify(prefs),
    });
}

export function createChatSpecialistCandidate(
    sessionId: string,
    body: {
        turnId?: string;
        suggestion: ChatSpecialistCandidateSuggestionRecord;
    },
): Promise<ChatSpecialistCandidateRecord> {
    return request(chatSessionPath(sessionId, '/specialist-candidates'), {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function updateChatSpecialistCandidate(
    sessionId: string,
    candidateId: string,
    body: ChatSpecialistCandidatePatchInput,
): Promise<ChatSpecialistCandidateRecord> {
    return request(chatSessionPath(sessionId, `/specialist-candidates/${encodeURIComponent(candidateId)}`), {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

// ─── Approvals ───────────────────────────────────
export function fetchApprovals(): Promise<{ items: ApprovalRequest[] }> {
    return request('/api/v1/approvals?status=pending');
}

export function resolveApproval(
    approvalId: string,
    decision: 'approve' | 'reject',
    note?: string,
): Promise<ApprovalRequest> {
    return request(`/api/v1/approvals/${approvalId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
            decision,
            resolutionNote: note,
            resolvedBy: 'mobile-operator',
        }),
    });
}

// ─── Agents ──────────────────────────────────────
export function fetchAgents(): Promise<{ items: AgentProfileRecord[] }> {
    return request('/api/v1/agents');
}

// ─── Settings / Providers ────────────────────────
export function fetchRuntimeSettings(): Promise<RuntimeSettings> {
    return request('/api/v1/settings');
}

export function fetchLlmModels(providerId?: string): Promise<{ items: LlmModelRecord[] }> {
    const query = providerId?.trim()
        ? `?providerId=${encodeURIComponent(providerId.trim())}`
        : '';
    return request(`/api/v1/llm/models${query}`);
}

// ─── Gateway Access / Pairing ───────────────────
export async function preflightGatewayAccess(): Promise<GatewayAccessPreflightResult> {
    if (!gatewayBaseUrl.trim()) {
        return {
            status: 'misconfigured',
            message: 'Enter the gateway URL for this device before continuing.',
            healthDetail: 'Use your computer LAN IP, for example http://192.168.0.10:8787.',
        };
    }

    const checks: GatewayConnectionCheck[] = [];

    if (companionSession) {
        try {
            await ensureCompanionSessionReady();
            checks.push({
                id: 'companion-session',
                label: 'Companion session',
                path: '/api/v1/auth/companion/session/refresh',
                status: 'success',
                detail: 'Stored companion session is present and ready for gateway probes.',
            });
        } catch (error) {
            checks.push({
                id: 'companion-session',
                label: 'Companion session',
                path: '/api/v1/auth/companion/session/refresh',
                status: '401',
                detail: (error as Error).message || 'Stored companion session could not be refreshed.',
            });
            return {
                status: 'needs-auth',
                message: 'Stored companion credentials expired or could not be refreshed. Re-approve this device to continue.',
                healthDetail: formatGatewayChecks(checks),
                authMode: 'token',
                checks,
            };
        }
    }

    // ── Native module diagnostic ────────────────────────────────
    const nativeProbe = await probeNativeModule();
    checks.push({
        id: 'native-module',
        label: 'Native HTTP module',
        path: 'NativeModules.GatewayHttp',
        status: nativeProbe.available ? 'success' : 'transport-blocked',
        detail: nativeProbe.detail,
    });

    const healthProbe = await runGatewayProbe(GATEWAY_HEALTH_PATH, 'Health probe', false, 'health');
    checks.push(healthProbe.check);

    if (healthProbe.check.status !== 'success') {
        const cleartextBlocked = isCleartextBlockDetail(healthProbe.check.detail);
        return {
            status: healthProbe.check.status === 'http-error' ? 'misconfigured' : 'unreachable',
            message: healthProbe.check.status === 'transport-blocked' && cleartextBlocked
                ? 'Android blocked the app from sending cleartext HTTP traffic to the gateway.'
                : healthProbe.check.status === 'transport-blocked'
                    ? 'The mobile app could not complete the network request to the gateway.'
                : 'The mobile app cannot reach the gateway yet.',
            healthDetail: formatGatewayChecks(checks),
            checks,
        };
    }

    const authProbe = await runGatewayProbe(GATEWAY_AUTH_PROBE_PATH, 'Auth probe', true, 'auth');
    checks.push(authProbe.check);

    if (authProbe.check.status === 'success') {
        return {
            status: 'ready',
            message: 'Gateway reachability and access checks passed.',
            healthDetail: formatGatewayChecks(checks),
            checks,
        };
    }

    if (authProbe.check.status === '401') {
        return {
            status: 'needs-auth',
            message: 'Gateway credentials are required to continue on this device.',
            healthDetail: formatGatewayChecks(checks),
            authMode: authProbe.authMode,
            checks,
        };
    }

    if (authProbe.check.status === 'timeout' || authProbe.check.status === 'transport-blocked') {
        return {
            status: 'unreachable',
            message: 'The gateway answered /health, but the authenticated probe still could not complete.',
            healthDetail: formatGatewayChecks(checks),
            checks,
        };
    }

    return {
        status: 'misconfigured',
        message: 'The gateway answered the probe sequence, but the authenticated endpoint did not return a usable result.',
        healthDetail: formatGatewayChecks(checks),
        authMode: authProbe.authMode,
        checks,
    };
}

export function createDeviceAccessRequest(
    body: DeviceAccessRequestCreateInput,
): Promise<DeviceAccessRequestCreateResponse> {
    return request('/api/v1/auth/device-requests', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function pollGatewayDeviceAccessRequestStatus(
    requestId: string,
    requestSecret: string,
): Promise<DeviceAccessRequestStatusResponse> {
    return request(`/api/v1/auth/device-requests/${encodeURIComponent(requestId)}/status`, {
        method: 'GET',
        headers: {
            'x-goatcitadel-device-request-secret': requestSecret,
        },
    });
}

// ─── Skills ──────────────────────────────────────
export function fetchSkills(): Promise<{ items: SkillListItem[] }> {
    return request('/api/v1/skills');
}

// ─── MCP ─────────────────────────────────────────
export function fetchMcpServers(): Promise<{ items: McpServerRecord[] }> {
    return request('/api/v1/mcp/servers');
}

export function connectMcpServer(serverId: string): Promise<void> {
    return request(`/api/v1/mcp/servers/${serverId}/connect`, { method: 'POST', body: '{}' });
}

export function disconnectMcpServer(serverId: string): Promise<void> {
    return request(`/api/v1/mcp/servers/${serverId}/disconnect`, { method: 'POST', body: '{}' });
}

// ─── Cron / Scheduled Jobs ──────────────────────
export function fetchCronJobs(): Promise<{ items: CronJobRecord[] }> {
    return request('/api/v1/cron/jobs');
}

// ─── Skills (write) ────────────────────────────
export function updateSkillState(
    skillId: string,
    body: { state: SkillRuntimeState; note?: string },
): Promise<void> {
    return request(`/api/v1/skills/${skillId}/state`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function reloadSkills(): Promise<void> {
    return request('/api/v1/skills/reload', { method: 'POST', body: '{}' });
}

// ─── Settings (write) ───────────────────────────
export function patchSettings(
    body: Partial<{
        defaultToolProfile: string;
        budgetMode: string;
        networkAllowlist: string[];
        llm: {
            activeProviderId?: string;
            activeModel?: string;
        };
    }>,
): Promise<RuntimeSettings> {
    return request('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

// ─── Health Check ────────────────────────────────
export async function checkGatewayHealth(): Promise<boolean> {
    const probe = await runGatewayProbe(GATEWAY_HEALTH_PATH, 'Health probe', false, 'health');
    return probe.check.status === 'success';
}
