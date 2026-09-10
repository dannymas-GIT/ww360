/**
 * District auditing — schedule change audit and activity feed in District Admin Hub.
 */
import { ActivityAuditFeed } from '@/components/admin/ActivityAuditFeed';
import { AuditLogsPage } from '@/components/admin/AuditLogsPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, FileText } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const AUDIT_SUB_TABS = [
  { value: 'audit', label: 'Schedule audit', icon: FileText },
  { value: 'activity', label: 'Activity feed', icon: Activity },
] as const;

export type AuditingSubTab = (typeof AUDIT_SUB_TABS)[number]['value'];

export interface DistrictAuditingTabProps {
  initialSub?: string;
}

export function DistrictAuditingTab({ initialSub }: DistrictAuditingTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subParam = searchParams.get('sub') || initialSub || 'audit';
  const activeSub = AUDIT_SUB_TABS.some(t => t.value === subParam) ? subParam : 'audit';

  const setSub = useCallback(
    (sub: string) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'auditing');
        next.set('sub', sub);
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <Tabs value={activeSub} onValueChange={setSub} className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
        {AUDIT_SUB_TABS.map(item => {
          const Icon = item.icon;
          return (
            <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="audit" className="mt-0">
        <AuditLogsPage embedded />
      </TabsContent>

      <TabsContent value="activity" className="mt-0">
        <ActivityAuditFeed embedded />
      </TabsContent>
    </Tabs>
  );
}
