import { Badge } from '@/components/ui/badge';
import type { DeliveryDefaultPreview } from '@/services/alertNotificationService';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  BadgeCheck,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle,
  ClipboardList,
  Clock,
  Droplets,
  FileText,
  Flag,
  FlaskConical,
  GraduationCap,
  Hash,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  ScanSearch,
  Scale,
  Shield,
  Smartphone,
  Sparkles,
  Timer,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';

const ICON_MAP: Record<string, LucideIcon> = {
  'flask-conical': FlaskConical,
  wrench: Wrench,
  scale: Scale,
  'alert-triangle': AlertTriangle,
  sparkles: Sparkles,
  'badge-check': BadgeCheck,
  users: Users,
  'calendar-clock': CalendarClock,
  flag: Flag,
  'message-square': MessageSquare,
  'graduation-cap': GraduationCap,
  droplets: Droplets,
  'triangle-alert': AlertTriangle,
  'scan-search': ScanSearch,
  bell: Bell,
  info: Info,
  'building-2': Building2,
  'map-pin': MapPin,
  activity: Activity,
  calendar: Calendar,
  clock: Clock,
  'alert-circle': AlertCircle,
  user: User,
  hash: Hash,
  award: Award,
  timer: Timer,
  shield: Shield,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  'check-circle': CheckCircle,
};

const CHANNEL_META: Record<string, { label: string; icon: LucideIcon }> = {
  popup: { label: 'In-app popup', icon: Bell },
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
};

function FieldIcon({ name }: { name?: string }) {
  const Icon = ICON_MAP[name || 'info'] || Info;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function severityVariant(severity?: string | null): 'default' | 'secondary' | 'destructive' {
  if (severity === 'critical' || severity === 'violation') return 'destructive';
  if (severity === 'warning') return 'secondary';
  return 'default';
}

export interface AlertNotificationPreviewProps {
  preview: DeliveryDefaultPreview;
  showChannels?: boolean;
  showRecipients?: boolean;
  showPlainBody?: boolean;
}

export const AlertNotificationPreview: React.FC<AlertNotificationPreviewProps> = ({
  preview,
  showChannels = true,
  showRecipients = true,
  showPlainBody = false,
}) => {
  const HeaderIcon = ICON_MAP[preview.icon || 'bell'] || Bell;
  const accent = preview.accent_color || '#0284c7';

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl overflow-hidden border shadow-sm"
        style={{ borderColor: `${accent}33` }}
      >
        <div
          className="px-5 py-4 text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, #0f766e)` }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <HeaderIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold leading-tight">
                  {preview.headline || preview.subject}
                </h3>
                {preview.severity_label ? (
                  <Badge
                    variant={severityVariant(preview.severity)}
                    className="bg-white/20 text-white border-white/20"
                  >
                    {preview.severity_label}
                  </Badge>
                ) : null}
                {preview.is_test ? (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-900 border-amber-200"
                  >
                    Test
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs uppercase tracking-wide opacity-90 mt-1">
                {preview.category || 'Alert'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-background px-5 py-4 space-y-4">
          {preview.summary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{preview.summary}</p>
          ) : null}

          {preview.fields?.length ? (
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 border-b">
                Alert details
              </div>
              <div className="divide-y">
                {preview.fields.map((field, idx) => (
                  <div
                    key={`${field.label}-${idx}`}
                    className="flex items-start gap-3 px-3 py-2.5 text-sm"
                  >
                    <FieldIcon name={field.icon} />
                    <div className="min-w-0 flex-1 grid gap-0.5 sm:grid-cols-[140px_1fr]">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className="font-medium break-words">{field.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {preview.action_hint ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
                Recommended action
              </div>
              <p className="text-sm text-blue-900">{preview.action_hint}</p>
            </div>
          ) : null}
        </div>
      </div>

      {showChannels ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Delivery channels
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.channels.length ? (
              preview.channels.map(channel => {
                const meta = CHANNEL_META[channel] || { label: channel, icon: Bell };
                const ChannelIcon = meta.icon;
                return (
                  <Badge key={channel} variant="outline" className="gap-1.5 px-2.5 py-1">
                    <ChannelIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </Badge>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground">No channels enabled</span>
            )}
          </div>
        </div>
      ) : null}

      {showPlainBody && preview.body ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Plain-text version
          </div>
          <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans">
            {preview.body}
          </pre>
        </div>
      ) : null}

      {showRecipients ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Recipients ({preview.recipient_count})
          </div>
          {preview.recipients.length ? (
            <div className="space-y-2">
              {preview.recipients.map((recipient, idx) => (
                <div
                  key={`${recipient.label}-${idx}`}
                  className="text-sm border rounded-lg p-3 flex flex-wrap gap-2 items-center bg-muted/20"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{recipient.label}</span>
                  <Badge variant="outline">{recipient.type}</Badge>
                  {recipient.email ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {recipient.email}
                    </span>
                  ) : null}
                  {recipient.phone ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      {recipient.phone}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recipients resolved for the current roles and contacts.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default AlertNotificationPreview;
