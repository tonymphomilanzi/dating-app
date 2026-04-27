// src/hooks/useNotifications.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.client';
import { useAuth } from '../contexts/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  // ══════════════════════════════════════════════════════════════
  // FETCH NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!mountedRef.current) return;

    if (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } else {
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    }

    setLoading(false);
  }, [user]);

  // ══════════════════════════════════════════════════════════════
  // MARK SINGLE NOTIFICATION AS READ
  // ══════════════════════════════════════════════════════════════
  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Update in database
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update on error
      await fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // ══════════════════════════════════════════════════════════════
  // MARK ALL NOTIFICATIONS AS READ
  // ══════════════════════════════════════════════════════════════
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    // Update in database
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      // Revert optimistic update on error
      await fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // ══════════════════════════════════════════════════════════════
  // DELETE NOTIFICATION
  // ══════════════════════════════════════════════════════════════
  const deleteNotification = useCallback(async (notificationId) => {
    if (!user) return;

    // Find if the notification was unread
    const notification = notifications.find(n => n.id === notificationId);
    const wasUnread = notification && !notification.read;

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // Delete from database
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting notification:', error);
      // Revert optimistic update on error
      await fetchNotifications();
    }
  }, [user, notifications, fetchNotifications]);

  // ══════════════════════════════════════════════════════════════
  // INITIAL FETCH
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    return () => { 
      mountedRef.current = false; 
    };
  }, [fetchNotifications]);

  // ══════════════════════════════════════════════════════════════
  // REAL-TIME SUBSCRIPTION
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!mountedRef.current) return;

          if (payload.eventType === 'INSERT') {
            // New notification received
            setNotifications(prev => [payload.new, ...prev]);
            if (!payload.new.read) {
              setUnreadCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Notification updated
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
            // Recalculate unread count
            setNotifications(prev => {
              const newUnreadCount = prev.filter(n => !n.read).length;
              setUnreadCount(newUnreadCount);
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            // Notification deleted
            const deletedNotification = notifications.find(n => n.id === payload.old.id);
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            if (deletedNotification && !deletedNotification.read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}