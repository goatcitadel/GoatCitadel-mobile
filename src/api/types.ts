/**
 * GoatCitadel Mobile — Portable contract types
 * Shared gateway contracts are re-exported from @goatcitadel/contracts.
 * Mobile-only request/view-model shapes stay local to this module.
 */

import type {
    AgentProfileRecord,
    ApprovalRequest,
    ApprovalStatus,
    ChatAttachmentRecord,
    ChatInputPart,
    ChatSessionRecord,
    CronJobRecord,
    DashboardState,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestDeviceType,
    DeviceAccessRequestStatus,
    DeviceAccessRequestStatusResponse,
    McpServerRecord,
    RealtimeEvent,
    SessionMeta,
    SkillListItem,
    SkillRuntimeState,
    SystemVitals,
} from '@goatcitadel/contracts';

export type {
    AgentProfileRecord,
    ApprovalRequest,
    ApprovalStatus,
    ChatAttachmentRecord,
    ChatInputPart,
    ChatSessionRecord,
    CronJobRecord,
    DashboardState,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestStatus,
    DeviceAccessRequestStatusResponse,
    McpServerRecord,
    RealtimeEvent,
    SessionMeta,
    SkillListItem,
    SkillRuntimeState,
    SystemVitals,
};

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

export interface ChatMessageRecord {
    messageId: string;
    sessionId: string;
    role: ChatMessageRole;
    actorType: 'user' | 'agent' | 'system';
    actorId: string;
    content: string;
    parts?: ChatInputPart[];
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
    parts?: ChatInputPart[];
    providerId?: string;
    model?: string;
    mode?: ChatMode;
    webMode?: ChatWebMode;
    memoryMode?: ChatMemoryMode;
    thinkingLevel?: ChatThinkingLevel;
    attachments?: string[];
}

export interface ChatSendMessageResponse {
    sessionId: string;
    userMessage: ChatMessageRecord;
    assistantMessage?: ChatMessageRecord;
    transport: 'llm' | 'integration';
    model?: string;
    turnId?: string;
    trace?: ChatTurnTraceRecord;
    citations?: ChatCitationRecord[];
    routing?: ChatTurnTraceRecord['routing'];
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
export type DeviceAccessDeviceType = DeviceAccessRequestDeviceType;
export type GatewayConnectionCheckStatus = 'success' | 'transport-blocked' | 'timeout' | '401' | 'http-error';

export interface GatewayConnectionCheck {
    id: 'native-module' | 'health' | 'auth';
    label: string;
    path: string;
    status: GatewayConnectionCheckStatus;
    detail: string;
    statusCode?: number;
}

export interface GatewayAccessPreflightResult {
    status: GatewayAccessPreflightStatus;
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayConnectionCheck[];
}
