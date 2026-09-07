import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchNotificationSummary,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/notificationService';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const reload = async () => {
    const [summary, list] = await Promise.all([
      fetchNotificationSummary().catch(() => ({ unread: 0 })),
      fetchNotifications().catch(() => []),
    ]);
    setUnread(summary.unread);
    setItems(list);
  };

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-300 hover:text-white relative"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-sky-500 text-[10px] text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border bg-white text-slate-900 shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              className="text-xs text-sky-600"
              onClick={() => void markAllNotificationsRead().then(reload)}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">No notifications yet.</p>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} className={`border-b last:border-0 ${n.read_at ? 'opacity-60' : ''}`}>
                  <Link
                    to={n.link_path || '/dashboard'}
                    className="block px-3 py-2 hover:bg-slate-50 text-sm"
                    onClick={() => {
                      void markNotificationRead(n.id).then(reload);
                      setOpen(false);
                    }}
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.body ? <p className="text-xs text-slate-500">{n.body}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
