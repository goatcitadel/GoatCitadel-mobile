/**
 * GoatCitadel Mobile — Notification Center Context
 * Maintains an in-app notification feed with badge counts, read/unread state,
 * and auto-polling for new events from the gateway.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchDashboard } from '../api/client';
import type { RealtimeEvent } from '../api/types';

export interface Notification {
    id: string;
    title: string;
    body: string;
    type: 'approval' | 'agent' | 'system' | 'chat' | 'cost';
    timestamp: string;
    read: boolean;
    icon: string;
    actionRoute?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    unreadCount: 0,
    markRead: () => { },
    markAllRead: () => { },
    clearAll: () => { },
});

function eventToNotification(event: RealtimeEvent): Notification {
    const typeMap: Record<string, Notification['type']> = {
        'approval.created': 'approval',
        'approval.resolved': 'approval',
        'agent.started': 'agent',
        'agent.completed': 'agent',
        'chat.message': 'chat',
        'chat.session_start': 'chat',
        'tool.executed': 'system',
        'system.health': 'system',
    };
    const iconMap: Record<string, string> = {
        'approval.created': 'lock-closed',
        'approval.resolved': 'lock-open',
        'agent.started': 'person-add',
        'agent.completed': 'checkmark-done',
        'chat.message': 'chatbubble',
        'chat.session_start': 'add-circle',
        'tool.executed': 'hammer',
        'system.health': 'pulse',
    };
    const titleMap: Record<string, string> = {
        'approval.created': 'New Approval Request',
        'approval.resolved': 'Approval Resolved',
        'agent.started': 'Agent Started',
        'agent.completed': 'Agent Completed',
        'chat.message': 'New Chat Message',
        'chat.session_start': 'Session Started',
        'tool.executed': 'Tool Executed',
        'system.health': 'System Health Update',
    };
    const routeMap: Record<string, string> = {
        'approval.created': '/(tabs)/approvals',
        'chat.message': '/(tabs)/chat',
        'agent.started': '/(tabs)/herd',
    };

    return {
        id: event.eventId,
        title: titleMap[event.eventType] || event.eventType,
        body: `Source: ${event.source}`,
        type: typeMap[event.eventType] || 'system',
        timestamp: event.timestamp,
        read: false,
        icon: iconMap[event.eventType] || 'notifications',
        actionRoute: routeMap[event.eventType],
    };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const seenIdsRef = useRef(new Set<string>());

    useEffect(() => {
        const poll = async () => {
            try {
                const dashboard = await fetchDashboard();
                const newNotifications: Notification[] = [];
                for (const event of dashboard.recentEvents) {
                    if (!seenIdsRef.current.has(event.eventId)) {
                        seenIdsRef.current.add(event.eventId);
                        newNotifications.push(eventToNotification(event));
                    }
                }
                if (newNotifications.length > 0) {
                    setNotifications(prev => [...newNotifications, ...prev].slice(0, 100));
                }
            } catch { }
        };

        poll();
        const interval = setInterval(poll, 15000);
        return () => clearInterval(interval);
    }, []);

    const markRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, clearAll }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
