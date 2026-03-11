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
} from './types';

let gatewayBaseUrl = 'http://127.0.0.1:8787';
let authToken: string | undefined;

export function setGatewayUrl(url: string) {
    gatewayBaseUrl = url.replace(/\/+$/, '');
}

export function setAuthToken(token: string | undefined) {
    authToken = token;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(method !== 'GET' ? { 'Idempotency-Key': generateId() } : {}),
        ...(init?.headers as Record<string, string> ?? {}),
    };

    const res = await fetch(`${gatewayBaseUrl}${path}`, {
        ...init,
        headers,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text.slice(0, 300)}`);
    }

    return unwrap<T>(await res.json());
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
        await fetch(`${gatewayBaseUrl}/api/health`, {
            method: 'GET',
            headers: authHeaders(),
        });
        return true;
    } catch {
        return false;
    }
}
