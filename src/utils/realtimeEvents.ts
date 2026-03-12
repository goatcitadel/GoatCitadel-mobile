import { Ionicons } from '@expo/vector-icons';
import type { RealtimeEvent } from '../api/types';

export type RealtimeNotificationType = 'approval' | 'agent' | 'system' | 'chat' | 'cost';
export type RealtimeLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface RealtimeEventMeta {
    canonicalType: string;
    title: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
    route?: string;
    notificationType: RealtimeNotificationType;
    logLevel: RealtimeLogLevel;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeRealtimeEventType(eventType: string): string {
    // Gateway always emits underscored names, but normalize dotted forms defensively.
    return eventType.replace(/\./g, '_');
}

function readDeviceSubject(payload: Record<string, unknown>): string {
    return (
        asString(payload.deviceLabel)
        || asString(payload.platform)
        || asString(payload.deviceType)
        || 'A device'
    );
}

function summarizeApprovalCreated(payload: Record<string, unknown>): string {
    const kind = asString(payload.kind) ?? 'approval';
    const riskLevel = asString(payload.riskLevel);
    return riskLevel ? `${kind} (${riskLevel})` : kind;
}

function summarizeApprovalResolved(payload: Record<string, unknown>): string {
    const decision = asString(payload.decision) || asString(payload.status);
    if (decision) {
        return `Approval ${decision}.`;
    }
    return 'Approval updated.';
}

function summarizeDeviceResolution(payload: Record<string, unknown>): string {
    const subject = readDeviceSubject(payload);
    const status = asString(payload.status);
    if (status === 'approved') {
        return `${subject} was approved.`;
    }
    if (status === 'rejected') {
        return `${subject} was rejected.`;
    }
    if (status === 'expired') {
        return `${subject} expired before approval.`;
    }
    if (status) {
        return `${subject} is now ${status}.`;
    }
    return `${subject} was updated.`;
}

function buildDetailRoute(baseRoute: string, id?: string): string {
    const trimmed = id?.trim();
    if (!trimmed) {
        return baseRoute;
    }
    return `${baseRoute}/${encodeURIComponent(trimmed)}`;
}

function readApprovalRoute(payload: Record<string, unknown>): string {
    return buildDetailRoute('/(tabs)/approvals', asString(payload.approvalId));
}

function readChatRoute(payload: Record<string, unknown>): string {
    return buildDetailRoute('/(tabs)/chat', asString(payload.sessionId));
}

function readAgentRoute(payload: Record<string, unknown>): string {
    const agentId = asString(payload.agentId);
    return agentId ? buildDetailRoute('/(tabs)/agent', agentId) : '/(tabs)/herd';
}

export function getRealtimeEventMeta(event: RealtimeEvent): RealtimeEventMeta {
    const canonicalType = normalizeRealtimeEventType(event.eventType);
    const payload = asRecord(event.payload);

    switch (canonicalType) {
        case 'approval_created':
            return {
                canonicalType,
                title: 'New Approval Request',
                body: summarizeApprovalCreated(payload),
                icon: 'lock-closed',
                route: readApprovalRoute(payload),
                notificationType: 'approval',
                logLevel: 'warn',
            };
        case 'approval_resolved':
            return {
                canonicalType,
                title: 'Approval Resolved',
                body: summarizeApprovalResolved(payload),
                icon: 'lock-open',
                route: readApprovalRoute(payload),
                notificationType: 'approval',
                logLevel: 'info',
            };
        case 'auth_device_request_created':
            return {
                canonicalType,
                title: 'Device Access Requested',
                body: `${readDeviceSubject(payload)} is waiting for approval.`,
                icon: 'phone-portrait',
                route: readApprovalRoute(payload),
                notificationType: 'approval',
                logLevel: 'warn',
            };
        case 'auth_device_request_resolved': {
            const status = asString(payload.status);
            return {
                canonicalType,
                title: 'Device Access Updated',
                body: summarizeDeviceResolution(payload),
                icon: status === 'approved' ? 'shield-checkmark' : 'close-circle',
                route: readApprovalRoute(payload),
                notificationType: 'approval',
                logLevel: status === 'approved' ? 'info' : 'warn',
            };
        }
        case 'subagent_registered':
            return {
                canonicalType,
                title: 'Agent Started',
                body: `Source: ${event.source}`,
                icon: 'person-add',
                route: readAgentRoute(payload),
                notificationType: 'agent',
                logLevel: 'info',
            };
        case 'subagent_updated':
            return {
                canonicalType,
                title: 'Agent Updated',
                body: `Source: ${event.source}`,
                icon: 'checkmark-done',
                route: readAgentRoute(payload),
                notificationType: 'agent',
                logLevel: 'info',
            };
        case 'chat_message':
            return {
                canonicalType,
                title: 'New Chat Message',
                body: `Source: ${event.source}`,
                icon: 'chatbubble',
                route: readChatRoute(payload),
                notificationType: 'chat',
                logLevel: 'info',
            };
        case 'session_event':
            return {
                canonicalType,
                title: 'Session Event',
                body: `Source: ${event.source}`,
                icon: 'add-circle',
                route: readChatRoute(payload),
                notificationType: 'chat',
                logLevel: 'info',
            };
        case 'tool_invoked':
            return {
                canonicalType,
                title: 'Tool Invoked',
                body: `Source: ${event.source}`,
                icon: 'hammer',
                notificationType: 'system',
                logLevel: 'debug',
            };
        case 'system':
            return {
                canonicalType,
                title: 'System Event',
                body: `Source: ${event.source}`,
                icon: 'pulse',
                notificationType: 'system',
                logLevel: 'info',
            };
        case 'orchestration_event':
            return {
                canonicalType,
                title: 'Orchestration',
                body: `Source: ${event.source}`,
                icon: 'git-network',
                notificationType: 'system',
                logLevel: 'info',
            };
        case 'activity_logged':
            return {
                canonicalType,
                title: 'Activity',
                body: `Source: ${event.source}`,
                icon: 'document-text',
                notificationType: 'system',
                logLevel: 'debug',
            };
        case 'task_created':
        case 'task_updated':
        case 'task_deleted':
            return {
                canonicalType,
                title: canonicalType === 'task_created' ? 'Task Created' : canonicalType === 'task_updated' ? 'Task Updated' : 'Task Deleted',
                body: `Source: ${event.source}`,
                icon: 'list',
                notificationType: 'system',
                logLevel: 'info',
            };
        case 'deliverable_added':
            return {
                canonicalType,
                title: 'Deliverable Added',
                body: `Source: ${event.source}`,
                icon: 'archive',
                notificationType: 'system',
                logLevel: 'info',
            };
        default:
            return {
                canonicalType,
                title: canonicalType,
                body: `Source: ${event.source}`,
                icon: 'ellipse',
                notificationType: 'system',
                logLevel: 'info',
            };
    }
}
