/**
 * GoatCitadel Mobile — Portable contract types
 * Subset of @goatcitadel/contracts for mobile use.
 */

// ─── Chat ────────────────────────────────────────
export type ChatMode = 'chat' | 'cowork' | 'code';
export type ChatWebMode = 'auto' | 'off' | 'quick' | 'deep';
export type ChatMemoryMode = 'auto' | 'on' | 'off';
export type ChatThinkingLevel = 'minimal' | 'standard' | 'extended';
export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatTurnBranchKind = 'append' | 'retry' | 'edit';
export type ChatDelegationStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ChatDelegationRunStatus = 'running' | 'completed' | 'failed' | 'partial';
export type ChatOrchestrationVisibility = 'hidden' | 'summarized' | 'expandable' | 'explicit';

export interface ChatSessionRecord {
    sessionId: string;
    sessionKey: string;
    workspaceId?: string;
    scope: 'mission' | 'external';
    title?: string;
    pinned: boolean;
    lifecycleStatus: 'active' | 'archived';
    projectId?: string;
    projectName?: string;
    channel: string;
    account: string;
    updatedAt: string;
    lastActivityAt: string;
    tokenTotal: number;
    costUsdTotal: number;
}

export interface ChatMessageRecord {
    messageId: string;
    sessionId: string;
    role: ChatMessageRole;
    actorType: 'user' | 'agent' | 'system';
    actorId: string;
    content: string;
    timestamp: string;
    tokenInput?: number;
    tokenOutput?: number;
    costUsd?: number;
    attachments?: Array<{
        attachmentId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
    }>;
}

export interface ChatToolRunRecord {
    toolRunId: string;
    turnId: string;
    sessionId: string;
    toolName: string;
    status: 'started' | 'executed' | 'blocked' | 'approval_required' | 'failed';
    approvalId?: string;
    startedAt: string;
    finishedAt?: string;
    args?: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
}

export interface ChatCitationRecord {
    citationId: string;
    title?: string;
    url: string;
    snippet?: string;
    sourceType?: 'web' | 'file' | 'tool';
}

export interface ChatOrchestrationStepSummary {
    stepId: string;
    role: string;
    index: number;
    status: ChatDelegationStepStatus;
    providerId?: string;
    model?: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    summary?: string;
    error?: string;
}

export interface ChatOrchestrationSummary {
    runId: string;
    objective: string;
    workflowTemplate: string;
    status: ChatDelegationRunStatus;
    modePolicy: ChatMode;
    visibility: ChatOrchestrationVisibility;
    finalSummary?: string;
    steps: ChatOrchestrationStepSummary[];
}

export interface ChatTurnTraceRecord {
    turnId: string;
    sessionId: string;
    userMessageId: string;
    parentTurnId?: string;
    branchKind: ChatTurnBranchKind;
    status: 'running' | 'completed' | 'failed' | 'approval_required';
    mode: ChatMode;
    model?: string;
    startedAt: string;
    finishedAt?: string;
    toolRuns: ChatToolRunRecord[];
    citations: ChatCitationRecord[];
    routing: {
        effectiveProviderId?: string;
        effectiveModel?: string;
        fallbackUsed?: boolean;
    };
    orchestration?: ChatOrchestrationSummary;
}

export interface ChatThreadTurnBranchRecord {
    siblingTurnIds: string[];
    activeSiblingIndex: number;
    siblingCount: number;
    isSelectedPath: boolean;
    newestLeafTurnId: string;
}

export interface ChatThreadTurnRecord {
    turnId: string;
    parentTurnId?: string;
    branchKind: ChatTurnBranchKind;
    userMessage: ChatMessageRecord;
    assistantMessage?: ChatMessageRecord;
    trace: ChatTurnTraceRecord;
    toolRuns: ChatToolRunRecord[];
    citations: ChatCitationRecord[];
    branch: ChatThreadTurnBranchRecord;
}

export interface ChatThreadResponse {
    sessionId: string;
    activeLeafTurnId?: string;
    turns: ChatThreadTurnRecord[];
}

export interface ChatSessionPrefsRecord {
    sessionId: string;
    mode: ChatMode;
    providerId?: string;
    model?: string;
    webMode: ChatWebMode;
    memoryMode: ChatMemoryMode;
    thinkingLevel: ChatThinkingLevel;
    orchestrationEnabled: boolean;
    orchestrationVisibility: ChatOrchestrationVisibility;
}

export interface ChatSendMessageRequest {
    content: string;
    providerId?: string;
    model?: string;
    mode?: ChatMode;
    webMode?: ChatWebMode;
    thinkingLevel?: ChatThinkingLevel;
    attachments?: string[];
}

// ─── Streaming ───────────────────────────────────
export type ChatStreamChunk =
    | { type: 'message_start'; sessionId: string; turnId: string; messageId: string }
    | { type: 'delta'; sessionId: string; turnId: string; delta: string }
    | { type: 'message_done'; sessionId: string; turnId: string; messageId: string; content: string }
    | { type: 'tool_start'; sessionId: string; turnId: string; toolRun: ChatToolRunRecord }
    | { type: 'tool_result'; sessionId: string; turnId: string; toolRun: ChatToolRunRecord }
    | { type: 'trace_update'; sessionId: string; turnId: string; trace: ChatTurnTraceRecord }
    | { type: 'citation'; sessionId: string; turnId: string; citation: ChatCitationRecord }
    | { type: 'error'; sessionId: string; turnId?: string; error: string }
    | { type: 'done'; sessionId: string; turnId: string; messageId: string };

// ─── Sessions ────────────────────────────────────
export type SessionHealth = 'healthy' | 'degraded' | 'blocked';
export type BudgetState = 'ok' | 'warning' | 'hard_cap';

export interface SessionMeta {
    sessionId: string;
    sessionKey: string;
    kind: 'dm' | 'group' | 'thread';
    channel: string;
    account: string;
    displayName?: string;
    lastActivityAt: string;
    updatedAt: string;
    health: SessionHealth;
    tokenTotal: number;
    costUsdTotal: number;
    budgetState: BudgetState;
}

// ─── Approvals ───────────────────────────────────
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export interface ApprovalExplanation {
    summary: string;
    riskExplanation: string;
    saferAlternative?: string;
    generatedAt: string;
}

export interface ApprovalRequest {
    approvalId: string;
    kind: string;
    riskLevel: 'safe' | 'caution' | 'danger' | 'nuclear';
    status: ApprovalStatus;
    payload: Record<string, unknown>;
    preview: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNote?: string;
    explanationStatus: 'not_requested' | 'pending' | 'completed' | 'failed';
    explanation?: ApprovalExplanation;
}

// ─── Agents ──────────────────────────────────────
export type AgentRuntimeStatus = 'active' | 'idle';

export interface AgentProfileRecord {
    agentId: string;
    roleId: string;
    name: string;
    title: string;
    summary: string;
    specialties: string[];
    status: AgentRuntimeStatus;
    sessionCount: number;
    activeSessions: number;
    isBuiltin: boolean;
}

// ─── Dashboard ───────────────────────────────────
export interface TaskStatusCount {
    status: string;
    count: number;
}

export interface RealtimeEvent {
    eventId: string;
    eventType: string;
    source: string;
    timestamp: string;
    payload: Record<string, unknown>;
}

export interface DashboardState {
    timestamp: string;
    sessions: SessionMeta[];
    pendingApprovals: number;
    activeSubagents: number;
    taskStatusCounts: TaskStatusCount[];
    recentEvents: RealtimeEvent[];
    dailyCostUsd: number;
}

export interface SystemVitals {
    hostname: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    cpuCount: number;
    memoryTotalBytes: number;
    memoryFreeBytes: number;
    memoryUsedBytes: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
}

// ─── Provider / LLM ─────────────────────────────
export interface ProviderRecord {
    providerId: string;
    label: string;
    baseUrl: string;
    defaultModel: string;
    hasApiKey: boolean;
}

export interface RuntimeSettings {
    defaultToolProfile: string;
    budgetMode: string;
    networkAllowlist: string[];
    auth: {
        mode: 'none' | 'token' | 'basic';
        allowLoopbackBypass: boolean;
    };
    llm: {
        activeProviderId: string;
        activeModel: string;
        providers: ProviderRecord[];
    };
}

// ─── Gateway Access / Pairing ───────────────────
export type GatewayAuthMode = 'none' | 'token' | 'basic';
export type GatewayAccessPreflightStatus = 'ready' | 'needs-auth' | 'unreachable' | 'misconfigured';
export type DeviceAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type DeviceAccessDeviceType = 'mobile' | 'desktop' | 'tablet' | 'browser' | 'unknown';

export interface GatewayAccessPreflightResult {
    status: GatewayAccessPreflightStatus;
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
}

export interface DeviceAccessRequestCreateInput {
    deviceLabel?: string;
    deviceType?: DeviceAccessDeviceType;
    platform?: string;
}

export interface DeviceAccessRequestCreateResponse {
    requestId: string;
    requestSecret: string;
    approvalId: string;
    status: DeviceAccessRequestStatus;
    expiresAt: string;
    pollAfterMs: number;
    message: string;
}

export interface DeviceAccessRequestStatusResponse {
    requestId: string;
    approvalId: string;
    status: DeviceAccessRequestStatus;
    expiresAt: string;
    resolvedAt?: string;
    deviceToken?: string;
    deviceTokenExpiresAt?: string;
    message: string;
}

// ─── Skills ──────────────────────────────────────
export type SkillRuntimeState = 'enabled' | 'sleep' | 'disabled';

export interface SkillListItem {
    skillId: string;
    name: string;
    description?: string;
    source?: string;
    state: SkillRuntimeState;
    note?: string;
    declaredTools?: string[];
    requires?: string[];
    isBuiltin: boolean;
}

// ─── MCP ─────────────────────────────────────────
export interface McpServerRecord {
    serverId: string;
    label: string;
    transport: string;
    status: 'connected' | 'disconnected' | 'error' | 'connecting';
    enabled: boolean;
    category?: string;
    trustTier?: 'trusted' | 'restricted' | 'quarantined';
    costTier?: 'free' | 'mixed' | 'paid' | 'unknown';
    toolCount: number;
    lastError?: string;
}

// ─── Cron / Scheduled Jobs ──────────────────────
export interface CronJobRecord {
    jobId: string;
    label?: string;
    schedule?: string;
    enabled: boolean;
    lastRunAt?: string;
    lastRunStatus?: string;
    nextRunAt?: string;
}
