/**
 * GoatCitadel Mobile — Gateway API Client
 */
import type {
    DashboardState,
    SystemVitals,
    ChatSessionRecord,
    ChatThreadResponse,
    ChatSendMessageRequest,
    ChatMessageRecord,
    ChatSessionPrefsRecord,
    ApprovalRequest,
    AgentProfileRecord,
    RuntimeSettings,
    SkillListItem,
    SkillRuntimeState,
    McpServerRecord,
    CronJobRecord,
    GatewayAccessPreflightResult,
    GatewayAuthMode,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestStatusResponse,
} from './types';

let gatewayBaseUrl = 'http://127.0.0.1:8787';
let authToken: string | undefined;

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

export function setGatewayUrl(url: string) {
    gatewayBaseUrl = url.replace(/\/+$/, '');
}

export function setAuthToken(token: string | undefined) {
    authToken = token?.trim() || undefined;
}

export function getAuthToken() {
    return authToken;
}

export function getGatewayUrl() {
    return gatewayBaseUrl;
}

function authHeaders(): Record<string, string> {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(method !== 'GET' ? { 'Idempotency-Key': generateId() } : {}),
        ...(init?.headers as Record<string, string> ?? {}),
    };

    let res: Response;
    try {
        res = await fetch(`${gatewayBaseUrl}${path}`, {
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

function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ─── Dashboard ───────────────────────────────────
export function fetchDashboard(): Promise<DashboardState> {
    return request('/api/dashboard');
}

export function fetchSystemVitals(): Promise<SystemVitals> {
    return request('/api/system/vitals');
}

// ─── Chat Sessions ───────────────────────────────
export function fetchChatSessions(): Promise<{ items: ChatSessionRecord[] }> {
    return request('/api/chat/sessions');
}

export function fetchChatThread(sessionId: string): Promise<ChatThreadResponse> {
    return request(`/api/chat/sessions/${sessionId}/thread`);
}

export function fetchChatPrefs(sessionId: string): Promise<ChatSessionPrefsRecord> {
    return request(`/api/chat/sessions/${sessionId}/prefs`);
}

export function sendChatMessage(
    sessionId: string,
    body: ChatSendMessageRequest,
): Promise<{ userMessage: ChatMessageRecord; assistantMessage?: ChatMessageRecord }> {
    return request(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function createChatSession(): Promise<ChatSessionRecord> {
    return request('/api/chat/sessions', { method: 'POST', body: '{}' });
}

export function deleteChatSession(sessionId: string): Promise<void> {
    return request(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
}

export function updateChatPrefs(
    sessionId: string,
    prefs: Partial<ChatSessionPrefsRecord>,
): Promise<ChatSessionPrefsRecord> {
    return request(`/api/chat/sessions/${sessionId}/prefs`, {
        method: 'PATCH',
        body: JSON.stringify(prefs),
    });
}

// ─── Approvals ───────────────────────────────────
export function fetchApprovals(): Promise<{ items: ApprovalRequest[] }> {
    return request('/api/approvals');
}

export function resolveApproval(
    approvalId: string,
    decision: 'approve' | 'reject',
    note?: string,
): Promise<ApprovalRequest> {
    return request(`/api/approvals/${approvalId}/resolve`, {
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
    return request('/api/agents');
}

// ─── Settings / Providers ────────────────────────
export function fetchRuntimeSettings(): Promise<RuntimeSettings> {
    return request('/api/settings/runtime');
}

// ─── Gateway Access / Pairing ───────────────────
async function probeGatewayReachability(): Promise<{ ok: boolean; detail: string }> {
    try {
        const response = await fetch(`${gatewayBaseUrl}/api/health`, {
            method: 'GET',
            headers: authHeaders(),
        });
        return {
            ok: true,
            detail: response.ok
                ? 'Gateway health endpoint responded.'
                : `Gateway responded with HTTP ${response.status}.`,
        };
    } catch (error) {
        return {
            ok: false,
            detail: (error as Error).message,
        };
    }
}

export async function preflightGatewayAccess(): Promise<GatewayAccessPreflightResult> {
    const health = await probeGatewayReachability();
    if (!health.ok) {
        return {
            status: 'unreachable',
            message: 'The mobile app cannot reach the gateway yet.',
            healthDetail: health.detail,
        };
    }

    try {
        await request('/api/v1/onboarding/state');
        return {
            status: 'ready',
            message: 'Gateway reachability and access checks passed.',
            healthDetail: health.detail,
        };
    } catch (error) {
        if (error instanceof GatewayApiError) {
            if (error.status === 401 || error.status === 403) {
                return {
                    status: 'needs-auth',
                    message: 'Gateway credentials are required to continue on this device.',
                    healthDetail: health.detail,
                    authMode: error.authMode,
                };
            }
            if (error.status === 503) {
                return {
                    status: 'misconfigured',
                    message: readApiErrorMessage(error.body) || 'Gateway auth is configured incorrectly on the server.',
                    healthDetail: health.detail,
                    authMode: error.authMode,
                };
            }
            if (error.kind === 'network') {
                return {
                    status: 'unreachable',
                    message: 'The gateway responded to health checks, but authenticated access still failed.',
                    healthDetail: error.message,
                };
            }
            return {
                status: 'misconfigured',
                message: readApiErrorMessage(error.body) || error.message,
                healthDetail: health.detail,
                authMode: error.authMode,
            };
        }
        return {
            status: 'misconfigured',
            message: (error as Error).message,
            healthDetail: health.detail,
        };
    }
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
    return request('/api/skills');
}

// ─── MCP ─────────────────────────────────────────
export function fetchMcpServers(): Promise<{ items: McpServerRecord[] }> {
    return request('/api/mcp/servers');
}

export function connectMcpServer(serverId: string): Promise<void> {
    return request(`/api/mcp/servers/${serverId}/connect`, { method: 'POST', body: '{}' });
}

export function disconnectMcpServer(serverId: string): Promise<void> {
    return request(`/api/mcp/servers/${serverId}/disconnect`, { method: 'POST', body: '{}' });
}

// ─── Cron / Scheduled Jobs ──────────────────────
export function fetchCronJobs(): Promise<{ items: CronJobRecord[] }> {
    return request('/api/cron/jobs');
}

// ─── Skills (write) ────────────────────────────
export function updateSkillState(
    skillId: string,
    body: { state: SkillRuntimeState; note?: string },
): Promise<void> {
    return request(`/api/skills/${skillId}/state`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function reloadSkills(): Promise<void> {
    return request('/api/skills/reload', { method: 'POST', body: '{}' });
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
    return request('/api/settings/runtime', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

// ─── Health Check ────────────────────────────────
export async function checkGatewayHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${gatewayBaseUrl}/api/health`, {
            method: 'GET',
            headers: authHeaders(),
        });
        return response.ok;
    } catch {
        return false;
    }
}
