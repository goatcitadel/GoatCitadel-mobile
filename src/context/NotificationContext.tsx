/**
 * GoatCitadel Mobile — Notification Center Context
 * Maintains an in-app notification feed with badge counts, read/unread state,
 * and auto-polling for new events from the gateway.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchDashboard } from '../api/client';
import type { RealtimeEvent } from '../api/types';
import { getRealtimeEventMeta } from '../utils/realtimeEvents';

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
    const meta = getRealtimeEventMeta(event);

    return {
        id: event.eventId,
        title: meta.title,
        body: meta.body,
        type: meta.notificationType,
        timestamp: event.timestamp,
        read: false,
        icon: meta.icon,
        actionRoute: meta.route,
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
