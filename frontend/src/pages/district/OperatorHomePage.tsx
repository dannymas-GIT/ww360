import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useKitchenSink } from '@/context/KitchenSinkContext';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { ww360PersonalizedTitle } from '@/components/ww360/ww360Greeting';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { WorkspaceTourOverlay } from '@/pages/workspaces/WorkspaceTourOverlay';
import {
  fetchMyTasks,
  fetchRecorderAccess,
  addTaskNote,
  type DocumentationTask,
  type RecorderAccess,
} from '@/services/documentationTaskService';
import { fetchCeuSummary } from '@/services/workforceSuccessionService';
import { WorkforceOperatorResponsibilityForm } from '@/components/workforce/WorkforceOperatorResponsibilityForm';
import { UsajobsJobListingsPanel } from '@/pages/workspaces/UsajobsJobListingsPanel';

const GRADE_REQUIREMENT_FALLBACK = 30;

export default function OperatorHomePage() {
  const { user, actingDistrictCode } = useAuth();
  const { personaKey } = useKitchenSink();
  const district = actingDistrictCode ?? user?.districts?.[0] ?? 'HFWD';
  const [tasks, setTasks] = useState<DocumentationTask[]>([]);
  const [recorder, setRecorder] = useState<RecorderAccess | null>(null);
  const [ceuHours, setCeuHours] = useState(0);
  const [progressDraft, setProgressDraft] = useState<Record<number, number>>({});

  const [ceuRequired, setCeuRequired] = useState(GRADE_REQUIREMENT_FALLBACK);

  const reload = useCallback(async () => {
    const [t, r, ceu] = await Promise.all([
      fetchMyTasks(),
      fetchRecorderAccess(district),
      fetchCeuSummary(district).catch(() => null),
    ]);
    setTasks(t);
    setRecorder(r);
    const mine = ceu?.operators?.find(o =>
      user?.full_name ? o.employee_name?.includes(user.full_name.split(' ')[0]) : false
    );
    const op = mine ?? ceu?.operators?.[0];
    setCeuHours(op?.earned_hours ?? 0);
    const required =
      op?.required_contact_hours ??
      (op?.required_hours != null ? op.required_hours * 10 : GRADE_REQUIREMENT_FALLBACK);
    setCeuRequired(required);
  }, [district, user?.full_name]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6 pb-12"
      data-landing="operator"
    >
      <WorkspaceTourOverlay profile="utility" personaKey={personaKey} autoOpen />
      <Ww360PageHero
        eyebrow={`${district} · Operator home`}
        title={ww360PersonalizedTitle(user, 'your operator home')}
        description={
          personaKey === 'mcwa-operator-1'
            ? 'Log CEU hours, sign up for training, and complete documentation tasks your manager assigns — no Succession Binder authoring from this role.'
            : 'Your CEU progress, documentation assignments, and responsibility notes for this utility.'
        }
      />

      <Ww360Section tourId="operator-ceu" title="My CEU hours">
        <div className="px-5 pb-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span>
              {ceuHours.toFixed(1)} / {ceuRequired.toFixed(0)} contact hrs (3-year cycle)
            </span>
            <Badge>{Math.round((ceuHours / ceuRequired) * 100)}%</Badge>
          </div>
          <Progress value={Math.min(100, (ceuHours / ceuRequired) * 100)} />
          <Button asChild size="sm" variant="outline">
            <Link to="/continuity/ceu-training?tab=ceu">Log CEU hours</Link>
          </Button>
        </div>
      </Ww360Section>

      <Ww360Section tourId="operator-training" title="Upcoming trainings">
        <div className="px-5 pb-5 text-sm space-y-2">
          <p>Distribution System Review — Learning Stream (Capital Region)</p>
          <p className="text-slate-500">Check the district calendar for your next session.</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/continuity/ceu-training?tab=training">View signups</Link>
          </Button>
        </div>
      </Ww360Section>

      <Ww360Section tourId="operator-tasks" title="My documentation tasks">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500 px-5 pb-5">
            No open tasks yet. When your manager assigns you primary/backup coverage, a documentation
            deadline appears here.
          </p>
        ) : (
          <ul className="space-y-4 px-5 pb-5">
            {tasks.map(task => {
              const progress =
                progressDraft[task.id] ?? task.notes?.slice(-1)[0]?.progress_pct ?? 0;
              return (
                <li key={task.id} className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.instructions}</p>
                    </div>
                    <Badge variant={task.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {task.status}
                    </Badge>
                  </div>
                  {task.due_at ? (
                    <p className="text-xs text-slate-500">Due {task.due_at.slice(0, 10)}</p>
                  ) : null}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-600">Progress ({progress}%)</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={progress}
                      className="w-full"
                      onChange={e =>
                        setProgressDraft(prev => ({ ...prev, [task.id]: Number(e.target.value) }))
                      }
                      onMouseUp={e =>
                        void addTaskNote(
                          task.id,
                          `Progress update: ${(e.target as HTMLInputElement).value}%`,
                          Number((e.target as HTMLInputElement).value)
                        ).then(reload)
                      }
                      onTouchEnd={e =>
                        void addTaskNote(
                          task.id,
                          `Progress update: ${(e.target as HTMLInputElement).value}%`,
                          Number((e.target as HTMLInputElement).value)
                        ).then(reload)
                      }
                    />
                  </div>
                  {task.notes?.length ? (
                    <div className="text-xs bg-white rounded p-2 space-y-1 border">
                      {task.notes.slice(-3).map(n => (
                        <p key={n.id}>
                          <strong>{n.created_at.slice(0, 10)}:</strong> {n.body}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Ww360Section>

      <Ww360Section tourId="operator-recorder" title="Document a responsibility">
        <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3 items-start">
          <p className="text-sm flex-1">
            {recorder?.can_record
              ? 'You have an active documentation assignment or recorder grant. Open Tutorial Studio to capture your process.'
              : 'Recording unlocks when your manager assigns you primary/backup coverage or grants recorder access.'}
          </p>
          <Button asChild disabled={!recorder?.can_record} className="shrink-0">
            <Link to="/studio">
              <Camera className="h-4 w-4 mr-2" />
              Open recorder
            </Link>
          </Button>
        </div>
      </Ww360Section>

      <Ww360Section tourId="operator-responsibility" title="Quick responsibility note">
        <div className="px-5 pb-5">
          <WorkforceOperatorResponsibilityForm districtCode={district} />
        </div>
      </Ww360Section>

      <UsajobsJobListingsPanel tourId="operator-federal-jobs" />
    </div>
  );
}
