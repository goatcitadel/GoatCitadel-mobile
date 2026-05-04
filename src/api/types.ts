/**
 * GoatCitadel Mobile — Portable contract types
 * Shared gateway contracts are re-exported from @goatcitadel/contracts.
 * Mobile-only request/view-model shapes stay local to this module.
 */

import type {
    AgentProfileRecord,
    ApprovalRequest,
    ApprovalStatus,
    ChatCapabilityUpgradeSuggestion,
    ChatAttachmentRecord,
    ChatInputPart,
    ChatSessionRecord,
    ChatStreamApprovalRecord,
    ChatStreamUsageRecord,
    ChatUserInputPromptAnswerRequest,
    ChatUserInputPromptAnswerResponse,
    ChatUserInputPromptRecord,
    CronJobRecord,
    DashboardState,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestDeviceType,
    DeviceAccessRequestStatus,
    DeviceAccessRequestStatusResponse,
    LlmApiStyle,
    LlmModelDiscoverySource,
    LlmModelPreviewRequest,
    LlmModelPreviewResponse,
    LlmModelRecord,
    LlmProviderAuthMode,
    LlmProviderConfig,
    LlmProviderRequestConfig,
    LlmProviderSummary,
    LlmRuntimeConfig,
    NpuRuntimeStatus,
    LlamaCppRuntimeStatus,
    McpServerRecord,
    RealtimeEvent,
    RoutingDecisionSnapshot,
    RoutingPreflightRequest,
    RoutingPreflightResult,
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
    ChatCapabilityUpgradeSuggestion,
    ChatInputPart,
    ChatSessionRecord,
    ChatStreamApprovalRecord,
    ChatStreamUsageRecord,
    ChatUserInputPromptAnswerRequest,
    ChatUserInputPromptAnswerResponse,
    ChatUserInputPromptRecord,
    CronJobRecord,
    DashboardState,
    DeviceAccessRequestCreateInput,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestStatus,
    DeviceAccessRequestStatusResponse,
    LlmApiStyle,
    LlmModelDiscoverySource,
    LlmModelPreviewRequest,
    LlmModelPreviewResponse,
    LlmModelRecord,
    LlmProviderAuthMode,
    LlmProviderConfig,
    LlmProviderRequestConfig,
    LlmProviderSummary,
    LlmRuntimeConfig,
    NpuRuntimeStatus,
    LlamaCppRuntimeStatus,
    McpServerRecord,
    RealtimeEvent,
    RoutingDecisionSnapshot,
    RoutingPreflightRequest,
    RoutingPreflightResult,
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
export type ChatPlanningMode = 'off' | 'advisory';
export type ChatProactiveMode = 'off' | 'suggest' | 'auto_safe' | 'auto_full';
export type ChatRetrievalMode = 'standard' | 'layered';
export type ChatReflectionMode = 'off' | 'on';
export type ChatOrchestrationIntensity = 'minimal' | 'balanced' | 'deep';
export type ChatOrchestrationProviderPreference = 'speed' | 'quality' | 'balanced' | 'low_cost';
export type ChatOrchestrationReviewDepth = 'off' | 'standard' | 'strict';
export type ChatOrchestrationParallelism = 'auto' | 'sequential' | 'parallel';
export type ChatCodeAutoApplyPosture = 'manual' | 'low_risk_auto' | 'aggressive_auto';
export type ChatNormalizationProfile = 'live' | 'prompt_pack_harness';
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
    reused?: boolean;
    reusedFromToolRunId?: string;
    reuseReason?: string;
    error?: string;
    failureGuidance?: string;
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
    | 'waiting_for_user_input'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type ChatTurnFailureClass =
    | 'provider_timeout'
    | 'network_interrupted'
    | 'tool_blocked'
    | 'tool_failed'
    | 'auth_required'
    | 'tool_loop_guard'
    | 'global_circuit_breaker'
    | 'tool_run_budget_exceeded'
    | 'turn_budget_exceeded'
    | 'budget_exceeded'
    | 'approval_required'
    | 'unknown';

export type ChatTurnRecoveryAction =
    | 'retry'
    | 'retry_narrower'
    | 'continue_from_partial'
    | 'reconnect_auth'
    | 'approve_pending_step'
    | 'switch_to_deep_mode'
    | 'check_gateway_connection';

export interface ChatTurnFailureRecord {
    failureClass: ChatTurnFailureClass;
    message: string;
    retryable?: boolean;
    recommendedAction?: ChatTurnRecoveryAction;
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
    sourceTurnId?: string;
    assistantMessageId?: string;
    status: ChatTurnLifecycleStatus;
    failure?: ChatTurnFailureRecord;
    completion?: {
        status: 'complete' | 'truncated' | 'interrupted' | 'backgrounded';
        reason?: string;
        repaired?: boolean;
        repair?: Record<string, unknown>;
    };
    mode: ChatMode;
    model?: string;
    webMode?: ChatWebMode;
    memoryMode?: ChatMemoryMode;
    thinkingLevel?: ChatThinkingLevel;
    effectiveToolAutonomy?: 'safe_auto' | 'manual';
    startedAt: string;
    finishedAt?: string;
    capabilitySnapshotId?: string;
    codeModeRunId?: string;
    pendingApprovalSummary?: ChatStreamApprovalRecord;
    pendingUserInput?: ChatUserInputPromptRecord;
    toolRuns: ChatToolRunRecord[];
    citations: ChatCitationRecord[];
    routing: {
        usedVisionFallback?: boolean;
        effectiveProviderId?: string;
        effectiveModel?: string;
        effectiveApiStyle?: LlmApiStyle;
        fallbackUsed?: boolean;
        liveDataIntent?: boolean;
        fallbackReason?: string;
        primaryProviderId?: string;
        primaryModel?: string;
        primaryApiStyle?: LlmApiStyle;
        fallbackProviderId?: string;
        fallbackModel?: string;
        fallbackApiStyle?: LlmApiStyle;
    };
    orchestration?: ChatOrchestrationSummary;
    executionPlan?: Record<string, unknown>;
    capabilityUpgradeSuggestions?: ChatCapabilityUpgradeSuggestion[];
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
    selectedTurnId?: string;
    turns: ChatThreadTurnRecord[];
}

export interface ChatAutonomyBudget {
    maxActionsPerHour: number;
    maxActionsPerTurn: number;
    cooldownSeconds: number;
}

export interface ChatSessionPrefsRecord {
    sessionId: string;
    mode: ChatMode;
    planningMode?: ChatPlanningMode;
    providerId?: string;
    model?: string;
    imageProviderId?: string;
    imageModel?: string;
    webMode: ChatWebMode;
    memoryMode: ChatMemoryMode;
    thinkingLevel: ChatThinkingLevel;
    toolAutonomy?: 'safe_auto' | 'manual';
    visionFallbackModel?: string;
    orchestrationEnabled: boolean;
    orchestrationIntensity?: ChatOrchestrationIntensity;
    orchestrationVisibility: ChatOrchestrationVisibility;
    orchestrationProviderPreference?: ChatOrchestrationProviderPreference;
    orchestrationReviewDepth?: ChatOrchestrationReviewDepth;
    orchestrationParallelism?: ChatOrchestrationParallelism;
    codeAutoApply?: ChatCodeAutoApplyPosture;
    proactiveMode?: ChatProactiveMode;
    autonomyBudget?: ChatAutonomyBudget;
    retrievalMode?: ChatRetrievalMode;
    reflectionMode?: ChatReflectionMode;
    createdAt?: string;
    updatedAt?: string;
}

export interface ChatSendMessageRequest {
    content: string;
    parts?: ChatInputPart[];
    providerId?: string;
    model?: string;
    routeDecision?: RoutingDecisionSnapshot;
    useMemory?: boolean;
    mode?: ChatMode;
    webMode?: ChatWebMode;
    memoryMode?: ChatMemoryMode;
    thinkingLevel?: ChatThinkingLevel;
    attachments?: string[];
    normalizationProfile?: ChatNormalizationProfile;
    commandText?: string;
    prefsOverride?: Partial<ChatSessionPrefsRecord>;
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
export interface ChatStreamChunkBase {
    sessionId: string;
    eventId?: string;
    sequence?: number;
    runId?: string;
}

export type ChatStreamChunk =
    | (ChatStreamChunkBase & { type: 'message_start'; turnId: string; messageId: string; parentTurnId?: string; branchKind?: ChatTurnBranchKind; sourceTurnId?: string })
    | (ChatStreamChunkBase & { type: 'delta'; turnId: string; messageId?: string; delta: string })
    | (ChatStreamChunkBase & { type: 'usage'; turnId: string; messageId?: string; usage: ChatStreamUsageRecord })
    | (ChatStreamChunkBase & { type: 'message_done'; turnId: string; messageId: string; content: string; repaired?: boolean; repair?: Record<string, unknown> })
    | (ChatStreamChunkBase & { type: 'tool_start'; turnId: string; toolRun: ChatToolRunRecord })
    | (ChatStreamChunkBase & { type: 'tool_result'; turnId: string; toolRun: ChatToolRunRecord })
    | (ChatStreamChunkBase & { type: 'approval_required'; turnId: string; approval: ChatStreamApprovalRecord })
    | (ChatStreamChunkBase & { type: 'user_input_required'; turnId: string; prompt: ChatUserInputPromptRecord })
    | (ChatStreamChunkBase & { type: 'trace_update'; turnId: string; trace: ChatTurnTraceRecord })
    | (ChatStreamChunkBase & { type: 'citation'; turnId: string; citation: ChatCitationRecord })
    | (ChatStreamChunkBase & { type: 'capability_upgrade_suggestion'; turnId: string; capabilityUpgradeSuggestions: ChatCapabilityUpgradeSuggestion[] })
    | (ChatStreamChunkBase & { type: 'error'; turnId?: string; error: string })
    | (ChatStreamChunkBase & { type: 'done'; turnId: string; messageId: string });

// ─── Provider / LLM ─────────────────────────────
export type ProviderRecord = LlmProviderSummary;

export interface RuntimeSettings {
    environment?: string;
    deploymentProfile?: 'local_dev' | 'trusted_local' | 'remote_hardened';
    defaultToolProfile: string;
    budgetMode: string;
    workspaceDir?: string;
    writeJailRoots?: string[];
    readOnlyRoots?: string[];
    readAccessMode?: 'roots_only' | 'approval_required' | 'full_disk';
    networkAllowlist: string[];
    approvalExplainer?: {
        enabled: boolean;
        mode: 'async';
        minRiskLevel: 'caution' | 'danger' | 'nuclear';
        providerId?: string;
        model?: string;
        timeoutMs: number;
        maxPayloadChars: number;
    };
    memory?: {
        enabled: boolean;
        qmd: {
            enabled: boolean;
            applyToChat: boolean;
            applyToOrchestration: boolean;
            minPromptChars: number;
            maxContextTokens: number;
            cacheTtlSeconds: number;
            distillerProviderId?: string;
            distillerModel?: string;
        };
    };
    web?: {
        firecrawl: {
            enabled: boolean;
            baseUrl: string;
            apiKeyEnv?: string;
            timeoutMs: number;
            defaultReadBackend: 'native' | 'firecrawl';
            fallbackToNative: boolean;
        };
    };
    auth: {
        mode: 'none' | 'token' | 'basic';
        allowLoopbackBypass: boolean;
        tokenConfigured?: boolean;
        basicConfigured?: boolean;
    };
    llm: LlmRuntimeConfig;
    mesh?: {
        enabled: boolean;
        mode: 'lan' | 'wan' | 'tailnet';
        nodeId: string;
        mdns: boolean;
        staticPeers: string[];
        requireMtls: boolean;
        tailnetEnabled: boolean;
    };
    npu?: {
        enabled: boolean;
        autoStart: boolean;
        sidecarUrl: string;
        status: NpuRuntimeStatus;
    };
    llamaCpp?: {
        enabled: boolean;
        autoStart: boolean;
        baseUrl: string;
        command: string;
        extraArgs: string[];
        modelsRootPath?: string;
        modelPath?: string;
        alias: string;
        ctxSize?: number;
        threads?: number;
        gpuLayers?: number;
        parallel?: number;
        batchSize?: number;
        ubatchSize?: number;
        flashAttention?: boolean;
        status: LlamaCppRuntimeStatus;
    };
    features?: Record<string, boolean>;
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

// ─── Mission Control Next mobile parity summaries ─────────────
export interface WorkspaceRecord {
    workspaceId: string;
    name: string;
    description?: string;
    rootPath?: string;
    archivedAt?: string;
    updatedAt?: string;
}

export interface ChatProjectRecord {
    projectId: string;
    workspaceId?: string;
    name: string;
    description?: string;
    workspacePath?: string;
    archivedAt?: string;
    updatedAt?: string;
}

export interface MemoryFileRecord {
    relativePath: string;
    size: number;
    modifiedAt: string;
}

export interface FileListRecord extends MemoryFileRecord { }

export interface MemoryItemRecord {
    itemId: string;
    namespace?: string;
    key?: string;
    value?: string;
    summary?: string;
    status?: string;
    updatedAt?: string;
}

export interface GeneratedArtifactRecord {
    artifactId: string;
    sessionId?: string;
    title?: string;
    kind?: string;
    sourceSurface?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ToolCatalogEntry {
    toolId: string;
    label?: string;
    description?: string;
    riskLevel?: string;
}

export interface AddonInstalledRecord {
    addonId: string;
    label?: string;
    version?: string;
    status?: string;
    running?: boolean;
}

export interface IntegrationConnectionRecord {
    connectionId: string;
    catalogId: string;
    label?: string;
    status?: string;
    enabled?: boolean;
}

export interface GatewayAccessPreflightResult {
    status: GatewayAccessPreflightStatus;
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayConnectionCheck[];
}
