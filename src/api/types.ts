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
export type ChatSpecialistCandidateStatus =
    | 'suggested'
    | 'drafted'
    | 'disabled'
    | 'approved'
    | 'active'
    | 'retired';
export type ChatSpecialistCandidateRoutingMode =
    | 'disabled'
    | 'manual_only'
    | 'strong_match_only';
export type ChatSpecialistCandidateSource =
    | 'manual'
    | 'runtime_gap'
    | 'replay';
export type ChatSpecialistCandidateEvidenceKind =
    | 'role_gap'
    | 'tool_gap'
    | 'skill_gap'
    | 'successful_workaround';

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

export type ChatTurnLifecycleStatus =
    | 'queued'
    | 'running'
    | 'waiting_for_tool'
    | 'waiting_for_approval'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type ChatTurnFailureClass =
    | 'provider_timeout'
    | 'network_interrupted'
    | 'tool_blocked'
    | 'tool_failed'
    | 'auth_required'
    | 'budget_exceeded'
    | 'approval_required'
    | 'unknown';

export interface ChatTurnFailureRecord {
    failureClass: ChatTurnFailureClass;
    message: string;
    retryable?: boolean;
}

export interface ChatSpecialistCandidateEvidenceRecord {
    evidenceId: string;
    kind: ChatSpecialistCandidateEvidenceKind;
    summary: string;
    turnId?: string;
    runId?: string;
    toolName?: string;
    skillRef?: string;
    confidence?: number;
}

export interface ChatSpecialistCandidateRoutingHints {
    preferredModes: ChatMode[];
    objectiveKeywords?: string[];
    requiresProjectBinding?: boolean;
    maxInvocationsPerRun?: number;
}

export interface ChatSpecialistCandidateRecord {
    candidateId: string;
    workspaceId?: string;
    sessionId: string;
    leadTurnId?: string;
    leadRunId?: string;
    title: string;
    role: string;
    summary: string;
    reason: string;
    source: ChatSpecialistCandidateSource;
    status: ChatSpecialistCandidateStatus;
    routingMode: ChatSpecialistCandidateRoutingMode;
    confidence: number;
    requiresApproval: boolean;
    suggestedTools?: string[];
    suggestedSkills?: string[];
    routingHints: ChatSpecialistCandidateRoutingHints;
    evidence: ChatSpecialistCandidateEvidenceRecord[];
    createdAt: string;
    updatedAt: string;
    activatedAt?: string;
    retiredAt?: string;
}

export interface ChatSpecialistCandidateSuggestionRecord {
    candidateId: string;
    title: string;
    role: string;
    summary: string;
    reason: string;
    source: ChatSpecialistCandidateSource;
    confidence: number;
    suggestedStatus: Extract<ChatSpecialistCandidateStatus, 'suggested' | 'drafted' | 'disabled'>;
    suggestedRoutingMode: ChatSpecialistCandidateRoutingMode;
    requiresApproval: true;
    suggestedTools?: string[];
    suggestedSkills?: string[];
    routingHints: ChatSpecialistCandidateRoutingHints;
    evidence: ChatSpecialistCandidateEvidenceRecord[];
}

export interface ChatSpecialistCandidateCreateInput {
    leadTurnId?: string;
    leadRunId?: string;
    title: string;
    role: string;
    summary: string;
    reason: string;
    source: ChatSpecialistCandidateSource;
    status?: ChatSpecialistCandidateStatus;
    routingMode?: ChatSpecialistCandidateRoutingMode;
    confidence: number;
    requiresApproval?: boolean;
    suggestedTools?: string[];
    suggestedSkills?: string[];
    routingHints: ChatSpecialistCandidateRoutingHints;
    evidence: ChatSpecialistCandidateEvidenceRecord[];
}

export interface ChatSpecialistCandidatePatchInput {
    title?: string;
    summary?: string;
    reason?: string;
    status?: ChatSpecialistCandidateStatus;
    routingMode?: ChatSpecialistCandidateRoutingMode;
    confidence?: number;
    suggestedTools?: string[];
    suggestedSkills?: string[];
    routingHints?: ChatSpecialistCandidateRoutingHints;
    evidence?: ChatSpecialistCandidateEvidenceRecord[];
}

export interface ChatOrchestrationSpecialistSelection {
    candidateId: string;
    title: string;
    role: string;
    summary: string;
    confidence: number;
    routingMode: ChatSpecialistCandidateRoutingMode;
    matchReason: string;
}

export interface ChatOrchestrationRouteDecision {
    templateId?: string;
    templateLabel?: string;
    rationale: string;
    selectedProviders: Array<{
        role: string;
        providerId?: string;
        model?: string;
        reason: string;
    }>;
    specialistCandidates?: ChatOrchestrationSpecialistSelection[];
}

export interface ChatOrchestrationStepSummary {
    stepId: string;
    role: string;
    index: number;
    status: ChatDelegationStepStatus;
    specialistCandidateId?: string;
    specialistTitle?: string;
    specialistRole?: string;
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
    routeDecision?: ChatOrchestrationRouteDecision;
    steps: ChatOrchestrationStepSummary[];
}

export interface ChatTurnTraceRecord {
    turnId: string;
    sessionId: string;
    userMessageId: string;
    parentTurnId?: string;
    branchKind: ChatTurnBranchKind;
    status: ChatTurnLifecycleStatus;
    failure?: ChatTurnFailureRecord;
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
        liveDataIntent?: boolean;
        fallbackReason?: string;
        primaryProviderId?: string;
        primaryModel?: string;
        fallbackProviderId?: string;
        fallbackModel?: string;
    };
    orchestration?: ChatOrchestrationSummary;
    specialistCandidateSuggestions?: ChatSpecialistCandidateSuggestionRecord[];
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

export interface ChatCancelTurnResponse {
    sessionId: string;
    turnId: string;
    cancelled: boolean;
    trace: ChatTurnTraceRecord;
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

export interface LlmModelRecord {
    id: string;
    ownedBy?: string;
    created?: number;
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
export type CompanionContractId = 'companion.android.v1';
export type CompanionSignatureAlgorithm = 'ed25519';

export interface GatewayConnectionCheck {
    id: 'native-module' | 'health' | 'auth' | 'companion-session';
    label: string;
    path: string;
    status: GatewayConnectionCheckStatus;
    detail: string;
    statusCode?: number;
}

export interface CompanionSessionExchangeInput {
    signingPublicKeyPem: string;
    clientName?: string;
    appVersion?: string;
}

export interface CompanionSessionTokenBundle {
    sessionId: string;
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    issuedAt: string;
    signatureAlgorithm: CompanionSignatureAlgorithm;
}

export interface CompanionSessionExchangeResponse extends CompanionSessionTokenBundle {
    contractId: CompanionContractId;
    grantId: string;
    actorId: string;
    deviceLabel: string;
    deviceType: DeviceAccessRequestDeviceType;
    platform?: string;
}

export interface CompanionSessionRefreshResponse extends CompanionSessionTokenBundle {
    contractId: CompanionContractId;
    grantId: string;
    actorId: string;
}

export interface CompanionSessionInfoResponse {
    contractId: CompanionContractId;
    sessionId: string;
    grantId: string;
    actorId: string;
    deviceLabel: string;
    deviceType: DeviceAccessRequestDeviceType;
    platform?: string;
    createdAt: string;
    lastSeenAt?: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
    signatureAlgorithm: CompanionSignatureAlgorithm;
    metadata: Record<string, unknown>;
}

export type FollowOnParityEpicState = 'have_foundation' | 'partial' | 'missing';

export interface FollowOnParityTargetRecord {
    catalogId: string;
    label: string;
    maturity: string;
    capabilities: string[];
}

export interface A2UIContractRecord {
    contractId: 'a2ui.v1';
    label: string;
    scopes: string[];
    transports: string[];
    operatorSurface: string;
    uiCapabilities: string[];
    platformCapabilities: string[];
    notes: string[];
}

export interface CompanionContractRecord {
    contractId: CompanionContractId;
    label: string;
    pairedSurfaceContractId: 'a2ui.v1';
    primaryTarget: string;
    bootstrapStatus: string;
    repoStrategy: string;
    bootstrapRepo: string;
    targetCatalogIds: string[];
    deviceCapabilities: string[];
    transportLanes: string[];
    authRequirements: string[];
    serverPrerequisites: string[];
    bootstrapFeatures: string[];
    notes: string[];
}

export interface FollowOnParityReadinessRecord {
    key: string;
    label: string;
    state: FollowOnParityEpicState;
    note: string;
}

export interface FollowOnParityEpicRecord {
    epicId: string;
    label: string;
    state: FollowOnParityEpicState;
    summary: string;
    nextSlice: string;
}

export interface FollowOnArtifactStatus {
    hasArtifact: boolean;
    freshness: 'missing' | 'stale' | 'current';
    ageDays?: number;
}

export interface FollowOnProfileArtifactStatus extends FollowOnArtifactStatus {
    latestArtifactDeploymentProfile?: string;
    matchedCurrentProfile: boolean;
}

export interface FollowOnProfileCoverageRecord {
    currentProfiles: string[];
    staleProfiles: string[];
    missingProfiles: string[];
}

export interface FollowOnStateToolRuntimeRecord {
    restrictedToProfile: string;
    registeredTools: string[];
    allowedTools: string[];
    blockedTools: string[];
}

export interface FollowOnPluginReferenceLifecycleRecord {
    referencePluginId: string;
    present: boolean;
    enabled: boolean;
    source?: string;
    matchesReferenceSource: boolean;
    capabilities: string[];
}

export interface FollowOnParityReport {
    generatedAt: string;
    deploymentProfile: string;
    authMode: GatewayAuthMode;
    packaging: {
        allowLoopbackBypass: boolean;
        networkAllowlistCount: number;
        postureSummary: string;
        proofStatus: FollowOnProfileArtifactStatus;
        proofCoverage: FollowOnProfileCoverageRecord;
        blockingIssues: string[];
        recommendedActions: string[];
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    browser: {
        totalToolCount: number;
        readToolCount: number;
        controlToolCount: number;
        guardrailSummary: string;
        stateToolRuntime: FollowOnStateToolRuntimeRecord;
        artifactStatus: FollowOnProfileArtifactStatus;
        blockingIssues: string[];
        recommendedActions: string[];
        automationCatalog?: FollowOnParityTargetRecord;
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    voice: {
        runtimeReadiness: string;
        selectedModelId?: string;
        talkState: string;
        wakeState: string;
        wakeEnabled: boolean;
        lastError?: string;
        artifactStatus: FollowOnProfileArtifactStatus;
        proofCoverage: FollowOnProfileCoverageRecord;
        blockingIssues: string[];
        recoveryActions: string[];
        recommendedActions: string[];
        automationCatalog?: FollowOnParityTargetRecord;
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    addons: {
        catalogCount: number;
        installedCount: number;
        runningCount: number;
    };
    plugins: {
        totalCount: number;
        enabledCount: number;
        sdkSummary: string;
        referenceLifecycle: FollowOnPluginReferenceLifecycleRecord;
        artifactStatus: FollowOnArtifactStatus;
        blockingIssues: string[];
        recommendedActions: string[];
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    canvas: {
        automationCatalog?: FollowOnParityTargetRecord;
        platformTargets: FollowOnParityTargetRecord[];
        contract?: A2UIContractRecord;
        paritySummary: string;
        artifactStatus: FollowOnProfileArtifactStatus;
        blockingIssues: string[];
        recommendedActions: string[];
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    companion: {
        platformTargets: FollowOnParityTargetRecord[];
        contract?: CompanionContractRecord;
        artifactStatus: FollowOnArtifactStatus;
        authReadiness: FollowOnParityReadinessRecord[];
        prerequisiteReadiness: FollowOnParityReadinessRecord[];
        paritySummary: string;
        blockingIssues: string[];
        recommendedActions: string[];
        latestArtifact?: FollowOnProofLaneArtifactRecord;
    };
    epics: FollowOnParityEpicRecord[];
}

export type FollowOnProofLaneArtifactLaneId =
    'browser'
    | 'packaging'
    | 'a2ui'
    | 'voice'
    | 'companion'
    | 'extensions';

export interface FollowOnProofLaneArtifactRecord {
    laneId: FollowOnProofLaneArtifactLaneId;
    generatedAt: string;
    summary: string;
    relativePath: string;
    fullPath: string;
    bytes: number;
    proofState?: 'draft' | 'complete' | 'evidence';
}

export interface GatewayAccessPreflightResult {
    status: GatewayAccessPreflightStatus;
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayConnectionCheck[];
}
