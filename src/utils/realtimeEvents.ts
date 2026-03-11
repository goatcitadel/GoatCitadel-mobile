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
    switch (eventType) {
        case 'approval.created':
            return 'approval_created';
        case 'approval.resolved':
            return 'approval_resolved';
        default:
            return eventType;
    }
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
                route: '/(tabs)/approvals',
                notificationType: 'approval',
                logLevel: 'warn',
            };
        case 'approval_resolved':
            return {
                canonicalType,
                title: 'Approval Resolved',
                body: summarizeApprovalResolved(payload),
                icon: 'lock-open',
                route: '/(tabs)/approvals',
                notificationType: 'approval',
                logLevel: 'info',
            };
        case 'auth_device_request_created':
            return {
                canonicalType,
                title: 'Device Access Requested',
                body: `${readDeviceSubject(payload)} is waiting for approval.`,
                icon: 'phone-portrait',
                route: '/(tabs)/approvals',
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
                route: '/(tabs)/approvals',
                notificationType: 'approval',
                logLevel: status === 'approved' ? 'info' : 'warn',
            };
        }
        case 'agent.started':
            return {
                canonicalType,
                title: 'Agent Started',
                body: `Source: ${event.source}`,
                icon: 'person-add',
                route: '/(tabs)/herd',
                notificationType: 'agent',
                logLevel: 'info',
            };
        case 'agent.completed':
            return {
                canonicalType,
                title: 'Agent Completed',
                body: `Source: ${event.source}`,
                icon: 'checkmark-done',
                route: '/(tabs)/herd',
                notificationType: 'agent',
                logLevel: 'info',
            };
        case 'chat.message':
            return {
                canonicalType,
                title: 'New Chat Message',
                body: `Source: ${event.source}`,
                icon: 'chatbubble',
                route: '/(tabs)/chat',
                notificationType: 'chat',
                logLevel: 'info',
            };
        case 'chat.session_start':
            return {
                canonicalType,
                title: 'Session Started',
                body: `Source: ${event.source}`,
                icon: 'add-circle',
                route: '/(tabs)/chat',
                notificationType: 'chat',
                logLevel: 'info',
            };
        case 'chat.session_end':
            return {
                canonicalType,
                title: 'Session Ended',
                body: `Source: ${event.source}`,
                icon: 'remove-circle',
                route: '/(tabs)/chat',
                notificationType: 'chat',
                logLevel: 'info',
            };
        case 'tool.executed':
            return {
                canonicalType,
                title: 'Tool Executed',
                body: `Source: ${event.source}`,
                icon: 'hammer',
                notificationType: 'system',
                logLevel: 'debug',
            };
        case 'system.health':
            return {
                canonicalType,
                title: 'System Health Update',
                body: `Source: ${event.source}`,
                icon: 'pulse',
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
