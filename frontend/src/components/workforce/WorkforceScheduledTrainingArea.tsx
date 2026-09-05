import { useMemo, useState, type ReactNode } from 'react';
import { Calendar, MapPin, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  useCancelTrainingEnrollment,
  useCreateScheduledTraining,
  useDeleteScheduledTraining,
  useEnrollInScheduledTraining,
  useScheduledTrainings,
} from '@/hooks/useWorkforceSuccession';
import type {
  WorkforceScheduledTrainingCreate,
  WorkforceScheduledTraining,
} from '@/services/workforceSuccessionService';
import {
  DeliveryModeBadge,
  GradeBadge,
  RoleIcon,
  TrainingStatusBadge,
} from '@/components/workforce/workforceBadges';

interface Props {
  districtCode: string;
  canManage?: boolean;
  operatorSelfEnrollEnabled?: boolean;
  onRecordCeu?: (training: WorkforceScheduledTraining) => void;
}

const EMPTY_FORM = {
  title: '',
  provider: '',
  location: '',
  delivery_mode: 'in_person',
  start_datetime: '',
  end_datetime: '',
  ceu_hours: '',
  cert_program: 'drinking_water',
  cert_type: 'treatment',
  target_grades: '',
  category: 'renewal',
  cost_text: '',
  registration_url: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  capacity: '',
  status: 'scheduled',
  notes: '',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function sourceBadge(source: string | null | undefined) {
  if (source === 'Learning Stream') {
    return (
      <Badge variant="secondary" className="bg-teal-100 text-teal-800">
        Learning Stream
      </Badge>
    );
  }
  return null;
}

export function WorkforceScheduledTrainingArea({
  districtCode,
  canManage = false,
  operatorSelfEnrollEnabled = false,
  onRecordCeu,
}: Props) {
  const { toast } = useToast();
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const filters = useMemo(
    () => ({
      district_code: districtCode,
      upcoming_only: upcomingOnly,
    }),
    [districtCode, upcomingOnly]
  );

  const trainingsQuery = useScheduledTrainings(filters);
  const createMutation = useCreateScheduledTraining();
  const deleteMutation = useDeleteScheduledTraining();
  const enrollMutation = useEnrollInScheduledTraining();
  const cancelMutation = useCancelTrainingEnrollment();

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const onSubmit = async () => {
    if (!form.title.trim() || !form.provider.trim() || !form.start_datetime) {
      toast({
        title: 'Missing required fields',
        description: 'Title, provider, and start date/time are required.',
        variant: 'destructive',
      });
      return;
    }
    const body: WorkforceScheduledTrainingCreate = {
      district_code: districtCode,
      title: form.title.trim(),
      provider: form.provider.trim(),
      location: form.location.trim() || null,
      delivery_mode: form.delivery_mode,
      start_datetime: form.start_datetime,
      end_datetime: form.end_datetime || null,
      ceu_hours: form.ceu_hours ? Number(form.ceu_hours) : null,
      cert_program: form.cert_program,
      cert_type: form.cert_type,
      target_grades: form.target_grades.trim() || null,
      category: form.category.trim() || null,
      cost_text: form.cost_text.trim() || null,
      registration_url: form.registration_url.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      source_course_id: null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    try {
      await createMutation.mutateAsync(body);
      toast({ title: 'Training scheduled' });
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: 'Could not save training',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id, districtCode });
      toast({ title: 'Training removed' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onEnroll = async (id: number) => {
    try {
      await enrollMutation.mutateAsync({ id, districtCode });
      toast({ title: 'Signed up for training' });
    } catch (err) {
      toast({
        title: 'Sign-up failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onCancelEnroll = async (id: number) => {
    try {
      await cancelMutation.mutateAsync({ id, districtCode });
      toast({ title: 'Sign-up cancelled' });
    } catch (err) {
      toast({
        title: 'Could not cancel sign-up',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const trainings = trainingsQuery.data?.trainings ?? [];
  const showSignUp = operatorSelfEnrollEnabled || canManage;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">District training sessions</h3>
          <p className="text-sm text-gray-500">
            All scheduled sessions for this district — including imports from Learning Stream.
            {canManage
              ? ' Enable operator sign-up in training settings so roster members can register themselves.'
              : showSignUp
                ? ' Sign up for open sessions below.'
                : ' Ask your manager to enable operator sign-up to register from this list.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={upcomingOnly ? 'upcoming' : 'all'}
            onValueChange={v => setUpcomingOnly(v === 'upcoming')}
          >
            <SelectTrigger className="w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming only</SelectItem>
              <SelectItem value="all">All sessions</SelectItem>
            </SelectContent>
          </Select>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Add training
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trainings.map(t => {
          const full =
            t.capacity != null &&
            (t.enrollment_count ?? 0) >= t.capacity &&
            !t.is_enrolled;
          return (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <RoleIcon certType={t.cert_type} className="mt-0.5 shrink-0" />
                    <div>
                      <CardTitle className="text-base leading-snug">{t.title}</CardTitle>
                      <p className="text-sm text-gray-500">{t.provider}</p>
                    </div>
                  </div>
                  <TrainingStatusBadge status={t.status} />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sourceBadge(t.catalog_source)}
                  {t.is_enrolled ? (
                    <Badge className="bg-emerald-100 text-emerald-800">Signed up</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {formatDateTime(t.start_datetime)}
                  {t.end_datetime ? ` – ${formatDateTime(t.end_datetime)}` : null}
                </div>
                {t.location ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {t.location}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <DeliveryModeBadge mode={t.delivery_mode} />
                  {t.target_grades
                    ? t.target_grades
                        .split(',')
                        .map(g => <GradeBadge key={g.trim()} grade={g.trim()} />)
                    : null}
                  {t.ceu_hours != null ? (
                    <span className="text-xs text-gray-500">{t.ceu_hours} contact hr</span>
                  ) : null}
                </div>
                {t.cost_text ? <p className="text-xs text-gray-500">{t.cost_text}</p> : null}
                {t.capacity != null ? (
                  <p className="text-xs text-gray-500">
                    {t.enrollment_count ?? 0} / {t.capacity} enrolled
                    {t.spots_remaining != null && t.spots_remaining <= 3 && !full
                      ? ` · ${t.spots_remaining} spot(s) left`
                      : null}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {t.registration_url ? (
                    <a
                      href={t.registration_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      External register
                    </a>
                  ) : null}
                  {operatorSelfEnrollEnabled && t.status === 'scheduled' ? (
                    t.is_enrolled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={cancelMutation.isPending}
                        onClick={() => void onCancelEnroll(t.id)}
                      >
                        <UserMinus className="mr-1 h-3 w-3" />
                        Cancel sign-up
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={enrollMutation.isPending || full}
                        onClick={() => void onEnroll(t.id)}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        {full ? 'Full' : 'Sign up'}
                      </Button>
                    )
                  ) : null}
                  {canManage && onRecordCeu && (t.status === 'completed' || t.status === 'scheduled') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onRecordCeu(t)}
                    >
                      Record CEUs
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7 text-red-600"
                      onClick={() => void onDelete(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!trainingsQuery.isLoading && trainings.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-gray-500">
          No district training sessions yet.
          {canManage
            ? ' Add one manually, schedule from the catalog, or import Learning Stream courses.'
            : ' Check back when your district publishes sessions.'}
        </div>
      ) : null}

      {canManage ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule training</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Field label="Title" required>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </Field>
              <Field label="Provider / sponsor" required>
                <Input
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" required>
                  <Input
                    type="datetime-local"
                    value={form.start_datetime}
                    onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))}
                  />
                </Field>
                <Field label="End">
                  <Input
                    type="datetime-local"
                    value={form.end_datetime}
                    onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Capacity">
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => void onSubmit()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
