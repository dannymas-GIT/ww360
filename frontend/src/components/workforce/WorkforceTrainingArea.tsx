import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  useTrainingCourses,
  useTriggerTrainingScrape,
  useCreateTrainingFromCourse,
} from '@/hooks/useWorkforceSuccession';
import type { TrainingCourseFilters } from '@/services/workforceSuccessionService';
import { DeliveryModeBadge } from '@/components/workforce/workforceBadges';
import { cn } from '@/lib/utils';

interface Props {
  initialFilters?: TrainingCourseFilters;
  districtCode?: string;
  canManage?: boolean;
  onCreatedFromCatalog?: () => void;
}

const ALL = '__all__';

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || '—';
}

function apiErrorDetail(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ===
      'string'
  ) {
    return (err as { response: { data: { detail: string } } }).response.data.detail;
  }
  return err instanceof Error ? err.message : String(err);
}

export function WorkforceTrainingArea({
  initialFilters,
  districtCode,
  canManage = false,
  onCreatedFromCatalog,
}: Props) {
  const { toast } = useToast();
  const [certProgram, setCertProgram] = useState(initialFilters?.cert_program ?? ALL);
  const [certType, setCertType] = useState(initialFilters?.cert_type ?? ALL);
  const [courseCategory, setCourseCategory] = useState(initialFilters?.course_category ?? ALL);
  const [sourceFilter, setSourceFilter] = useState(initialFilters?.source ?? ALL);
  const [grade, setGrade] = useState(initialFilters?.grade ?? '');
  const [upcomingOnly, setUpcomingOnly] = useState(initialFilters?.upcoming_only ?? false);
  const [localMetroOnly, setLocalMetroOnly] = useState(initialFilters?.local_metro_only ?? false);
  const [q, setQ] = useState(initialFilters?.q ?? '');

  useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.cert_program) setCertProgram(initialFilters.cert_program);
    if (initialFilters.cert_type) setCertType(initialFilters.cert_type);
    if (initialFilters.course_category) setCourseCategory(initialFilters.course_category);
    if (initialFilters.grade) setGrade(initialFilters.grade);
    if (initialFilters.upcoming_only != null) setUpcomingOnly(initialFilters.upcoming_only);
    if (initialFilters.local_metro_only != null) setLocalMetroOnly(initialFilters.local_metro_only);
    if (initialFilters.q) setQ(initialFilters.q);
  }, [initialFilters]);

  const filters = useMemo<TrainingCourseFilters>(
    () => ({
      cert_program: certProgram === ALL ? undefined : certProgram,
      cert_type: certType === ALL ? undefined : certType,
      course_category: courseCategory === ALL ? undefined : courseCategory,
      source: sourceFilter === ALL ? undefined : sourceFilter,
      grade: grade.trim() || undefined,
      upcoming_only: upcomingOnly,
      local_metro_only: localMetroOnly,
      q: q.trim() || undefined,
    }),
    [certProgram, certType, courseCategory, sourceFilter, grade, upcomingOnly, localMetroOnly, q]
  );

  const coursesQuery = useTrainingCourses(filters);
  const scrapeMutation = useTriggerTrainingScrape();
  const fromCourseMutation = useCreateTrainingFromCourse();

  const onCreateFromCourse = async (courseId: number) => {
    if (!districtCode) {
      toast({
        title: 'District required',
        description: 'Select a district before creating a scheduled training event.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await fromCourseMutation.mutateAsync({ districtCode, courseId });
      toast({ title: 'District training created from catalog course' });
      onCreatedFromCatalog?.();
    } catch (err) {
      toast({
        title: 'Could not create training',
        description: apiErrorDetail(err),
        variant: 'destructive',
      });
    }
  };

  const onRefresh = async () => {
    try {
      const result = await scrapeMutation.mutateAsync();
      toast({
        title: result.skipped_unchanged ? 'No changes on DOH page' : 'Training catalog refreshed',
        description: result.skipped_unchanged
          ? 'Page content unchanged since last scrape.'
          : `${result.courses_added} added, ${result.courses_updated} updated, ${result.courses_deactivated} deactivated.`,
      });
    } catch (err) {
      toast({
        title: 'Refresh failed',
        description: apiErrorDetail(err),
        variant: 'destructive',
      });
    }
  };

  const notYetScraped = !coursesQuery.data?.last_synced_at;
  const noCourses =
    !coursesQuery.isLoading && (coursesQuery.data?.courses?.length ?? 0) === 0;
  const emptyMessage = notYetScraped
    ? 'Catalog not yet synced from NYSDOH. Click Refresh from DOH to load courses.'
    : 'No courses match these filters. Try broadening your search or use All dates.';

  const colSpan = districtCode && canManage ? 9 : 8;
  const wrapCell = 'whitespace-normal align-top break-words [overflow-wrap:anywhere] max-w-0';
  const columnWidths = districtCode
    ? {
        description: 'w-[26%]',
        sponsor: 'w-[14%]',
        location: 'w-[10%]',
        delivery: 'w-[7%]',
        grade: 'w-[5%]',
        dates: 'w-[9%]',
        cost: 'w-[7%]',
        contact: 'w-[13%]',
        actions: 'w-[9%]',
      }
    : {
        description: 'w-[28%]',
        sponsor: 'w-[16%]',
        location: 'w-[12%]',
        delivery: 'w-[8%]',
        grade: 'w-[6%]',
        dates: 'w-[10%]',
        cost: 'w-[8%]',
        contact: 'w-[12%]',
        actions: '',
      };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Training catalog</h3>
          <p className="text-sm text-gray-500">
            NYSDOH statewide courses plus Learning Stream imports from One Water Workforce.
            Verify dates and fees with sponsors before registering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {coursesQuery.data?.last_synced_at ? (
            <Badge variant="outline">
              Last scraped{' '}
              {new Date(coursesQuery.data.last_synced_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Badge>
          ) : (
            <Badge variant="outline">Not yet scraped</Badge>
          )}
          {canManage ? (
            <Button
              variant="outline"
              size="sm"
              disabled={scrapeMutation.isPending}
              onClick={() => void onRefresh()}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh from DOH
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Program"
          value={certProgram}
          onChange={setCertProgram}
          options={[
            { value: ALL, label: 'All programs' },
            { value: 'drinking_water', label: 'Drinking water' },
            { value: 'wastewater', label: 'Wastewater' },
          ]}
        />
        <FilterSelect
          label="Cert type"
          value={certType}
          onChange={setCertType}
          options={[
            { value: ALL, label: 'All types' },
            { value: 'treatment', label: 'Treatment' },
            { value: 'distribution', label: 'Distribution' },
            { value: 'backflow', label: 'Backflow' },
            { value: 'wastewater', label: 'Wastewater' },
          ]}
        />
        <FilterSelect
          label="Source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: ALL, label: 'All sources' },
            { value: 'Learning Stream', label: 'Learning Stream' },
            { value: 'NYSDOH', label: 'NYSDOH' },
          ]}
        />
        <FilterSelect
          label="Category"
          value={courseCategory}
          onChange={setCourseCategory}
          options={[
            { value: ALL, label: 'Initial + renewal' },
            { value: 'initial', label: 'Initial certification' },
            { value: 'renewal', label: 'Renewal / CEU' },
          ]}
        />
        <div className="min-w-[6rem]">
          <label className="text-xs font-medium text-gray-600">Grade</label>
          <Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="A, B, C, D" />
        </div>
        <FilterSelect
          label="Timing"
          value={upcomingOnly ? 'upcoming' : 'all'}
          onChange={v => setUpcomingOnly(v === 'upcoming')}
          options={[
            { value: 'upcoming', label: 'Upcoming only' },
            { value: 'all', label: 'All dates' },
          ]}
        />
        <div className="min-w-[12rem] flex-1">
          <label className="text-xs font-medium text-gray-600">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Checkbox
            id="local-metro-only"
            checked={localMetroOnly}
            onCheckedChange={checked => setLocalMetroOnly(checked === true)}
          />
          <Label htmlFor="local-metro-only" className="text-xs font-normal text-gray-600">
            Local in-person only (Suffolk/Nassau/NYC)
          </Label>
        </div>
      </div>

      <div className="rounded-md border">
        <Table className="table-fixed w-full min-w-[64rem]">
          <TableHeader>
            <TableRow>
              <TableHead className={cn(columnWidths.description, 'whitespace-normal')}>
                Description
              </TableHead>
              <TableHead className={cn(columnWidths.sponsor, 'whitespace-normal')}>
                Sponsor
              </TableHead>
              <TableHead className={cn(columnWidths.location, 'whitespace-normal')}>
                Location
              </TableHead>
              <TableHead className={columnWidths.delivery}>Delivery</TableHead>
              <TableHead className={columnWidths.grade}>Grade</TableHead>
              <TableHead className={cn(columnWidths.dates, 'whitespace-normal')}>Dates</TableHead>
              <TableHead className={cn(columnWidths.cost, 'whitespace-normal')}>Cost</TableHead>
              <TableHead className={cn(columnWidths.contact, 'whitespace-normal')}>
                Contact
              </TableHead>
              {districtCode && canManage ? (
                <TableHead className={columnWidths.actions}>Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(coursesQuery.data?.courses ?? []).map(course => (
              <TableRow key={course.id}>
                <TableCell className={cn(columnWidths.description, wrapCell)}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{course.course_name}</span>
                      {course.source === 'Learning Stream' ? (
                        <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                          Learning Stream
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-600">{course.description || '—'}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {course.course_category.replace(/_/g, ' ')} ·{' '}
                      {course.cert_type.replace(/_/g, ' ')}
                      {course.contact_hours != null ? ` · ${course.contact_hours} hr` : ''}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(columnWidths.sponsor, wrapCell)}>
                  {course.sponsor}
                </TableCell>
                <TableCell className={cn(columnWidths.location, wrapCell)}>
                  {course.location_text || '—'}
                </TableCell>
                <TableCell className={cn(columnWidths.delivery, 'align-top')}>
                  {course.delivery_mode ? <DeliveryModeBadge mode={course.delivery_mode} /> : '—'}
                </TableCell>
                <TableCell className={cn(columnWidths.grade, 'align-top')}>
                  {course.grade || '—'}
                </TableCell>
                <TableCell className={cn(columnWidths.dates, wrapCell)}>
                  {formatDateRange(course.start_date, course.end_date)}
                </TableCell>
                <TableCell className={cn(columnWidths.cost, wrapCell)}>
                  {course.cost_text || '—'}
                </TableCell>
                <TableCell className={cn(columnWidths.contact, wrapCell)}>
                  <div className="space-y-1">
                    <div className="text-sm">{course.contact_phone || '—'}</div>
                    {course.contact_email ? (
                      <a
                        className="text-xs text-blue-600 hover:underline break-all"
                        href={`mailto:${course.contact_email}`}
                      >
                        {course.contact_email}
                      </a>
                    ) : null}
                  </div>
                </TableCell>
                {districtCode && canManage ? (
                  <TableCell className={cn(columnWidths.actions, 'align-top')}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fromCourseMutation.isPending || !course.start_date}
                      title={
                        course.start_date
                          ? 'Add to district upcoming training'
                          : 'No scheduled date on listing'
                      }
                      onClick={() => void onCreateFromCourse(course.id)}
                    >
                      <CalendarPlus className="mr-1 h-3 w-3" />
                      Schedule
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {noCourses ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm text-gray-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[10rem]">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
