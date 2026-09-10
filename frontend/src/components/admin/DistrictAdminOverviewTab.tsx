import {
  OperationsTile,
  OPERATIONS_ROW_SCROLL_CLASS,
} from '@/components/dashboard/OperationsTilesRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  getDistrictOperationsDashboardState,
  pinTileToDashboard,
} from '@/services/dashboardConfigApi';
import {
  DistrictOperationsTileId,
  fetchDistrictOperations,
  resolveTileCount,
} from '@/services/districtOperationsService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, Loader2, Pin, PinOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const PINNABLE_TILES: DistrictOperationsTileId[] = [
  'in_progress',
  'awaiting_lab',
  'overdue',
  'assigned',
  'scheduled',
  'needs_decision',
  'new_detect',
  'due_this_week',
  'due_this_month',
  'missed_schedule',
];

const DASHBOARD_STATE_QUERY_KEY = ['district-ops-dashboard-state'] as const;

export const DistrictAdminOverviewTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['district-operations'],
    queryFn: fetchDistrictOperations,
  });

  const {
    data: dashboardState,
    refetch: refetchDashboardState,
    isLoading: dashboardStateLoading,
  } = useQuery({
    queryKey: DASHBOARD_STATE_QUERY_KEY,
    queryFn: getDistrictOperationsDashboardState,
    staleTime: 0,
  });

  const pinnedSet = new Set(dashboardState?.pinnedTiles ?? []);

  const refreshDashboardState = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_STATE_QUERY_KEY });
    void refetchDashboardState();
  }, [queryClient, refetchDashboardState]);

  useEffect(() => {
    const onFocus = () => refreshDashboardState();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshDashboardState]);

  const handlePin = async (tileId: DistrictOperationsTileId) => {
    setPinBusy(tileId);
    try {
      const nowPinned = await pinTileToDashboard(tileId);
      refreshDashboardState();
      toast({
        title: nowPinned ? 'Added to dashboard' : 'Removed from dashboard',
        description: nowPinned
          ? 'This metric appears on your home District Operations widget.'
          : 'Tile removed from your dashboard widget.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not update dashboard',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPinBusy(null);
    }
  };

  const hasWidget = dashboardState?.hasWidget ?? false;

  return (
    <div className="space-y-6 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>Operations snapshot</CardTitle>
          <CardDescription>
            Scroll sideways to browse all metrics. Pin any tile to your home dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {!hasWidget && !dashboardStateLoading && (
            <p className="text-sm text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2">
              Add the District Operations widget on your home dashboard (customize mode → Add
              Widget), or pin a metric here — that will create the widget for you.
            </p>
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          {isError && (
            <p className="text-sm text-destructive">Failed to load district operations.</p>
          )}
          {data && (
            <div
              className={`${OPERATIONS_ROW_SCROLL_CLASS} items-stretch`}
              role="list"
              aria-label="Operations snapshot"
            >
              {PINNABLE_TILES.map(tileId => {
                const isPinned = pinnedSet.has(tileId);
                const pinLabel = isPinned ? 'Remove' : 'Add to dash';
                const pinAriaLabel = isPinned ? 'Remove from dashboard' : 'Add to dashboard';
                return (
                  <OperationsTile
                    key={tileId}
                    tileId={tileId}
                    count={resolveTileCount(0, tileId, data)}
                    layout="scroll"
                    className="flex flex-col"
                    footer={
                      <div className="mt-2 space-y-2 min-w-0">
                        {isPinned && (
                          <Badge variant="secondary" className="text-[10px]">
                            On your dashboard
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={isPinned ? 'outline' : 'default'}
                          className="w-full h-8 text-xs"
                          disabled={pinBusy === tileId || dashboardStateLoading}
                          aria-label={pinAriaLabel}
                          onClick={() => void handlePin(tileId)}
                        >
                          {pinBusy === tileId ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : isPinned ? (
                            <PinOff className="h-3 w-3 mr-1 shrink-0" />
                          ) : (
                            <Pin className="h-3 w-3 mr-1 shrink-0" />
                          )}
                          {pinLabel}
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/district-admin/utilities?tab=pws">PWS / EPA link</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/district-admin/utilities?tab=users">Users</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/district-admin/utilities?tab=roles">Roles</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/district-admin/utilities?tab=equipment">Equipment tagging</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/district-admin/utilities?tab=auditing">District auditing</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/sampling-schedules">Schedules</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/alerts">Alerts</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">Home dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="h-3 w-3 mr-1" />
              Customize
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistrictAdminOverviewTab;
