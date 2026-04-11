import { createIdempotencyKey } from '../../api/client';
import type {
    PhoneAssistAuditEvent,
    PhoneAssistAuditEventType,
    PhoneAssistCapabilityId,
    PhoneAssistSensitivity,
} from './contracts';
import { loadAuditEvents, saveAuditEvents } from './storage';

export async function listPhoneAssistAuditEvents(): Promise<PhoneAssistAuditEvent[]> {
    const events = await loadAuditEvents();
    return [...events].sort((left, right) => right.at.localeCompare(left.at));
}

export async function appendPhoneAssistAuditEvent(input: {
    type: PhoneAssistAuditEventType;
    summary: string;
    capability?: PhoneAssistCapabilityId;
    detail?: string;
    sensitivity?: PhoneAssistSensitivity;
}): Promise<PhoneAssistAuditEvent> {
    const event: PhoneAssistAuditEvent = {
        eventId: createIdempotencyKey(),
        type: input.type,
        at: new Date().toISOString(),
        capability: input.capability,
        summary: input.summary,
        detail: input.detail,
        sensitivity: input.sensitivity,
    };
    const current = await loadAuditEvents();
    await saveAuditEvents([event, ...current]);
    return event;
}
