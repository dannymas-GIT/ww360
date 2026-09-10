import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  abandonPlanningSession,
  commitWorkforceImport,
  cancelTrainingEnrollment,
  createCeuRecord,
  createScheduledTraining,
  createTrainingFromCourse,
  createWorkforceEntity,
  deleteCeuRecord,
  deleteCeuVoucher,
  deleteScheduledTraining,
  deleteWorkforceEntity,
  downloadCsvTemplate,
  ensurePlanningSession,
  fetchCeuRecords,
  fetchCeuSummary,
  fetchCeuRequirements,
  fetchCeuVouchers,
  fetchDistrictEmployerProfile,
  enrollInScheduledTraining,
  fetchImportBatches,
  fetchMyTrainingEnrollments,
  fetchPlanningSession,
  fetchScheduledTrainings,
  fetchTrainingCourses,
  fetchWorkforceContinuity,
  fetchWorkforceBinder,
  fetchBinderIntake,
  ensureBinderIntake,
  patchBinderIntake,
  completeBinderIntake,
  abandonBinderIntake,
  fetchWorkforceEntities,
  fetchWorkforceScorecards,
  fetchWorkforceWidgetSummary,
  generateWorkforceDocumentationPack,
  patchPlanningSession,
  previewWorkforceImport,
  publishPlanningSession,
  seedLearningStreamCourses,
  triggerWorkforceAlertScan,
  triggerTrainingScrape,
  updateDistrictEmployerProfile,
  updateWorkforceEntity,
  updateScheduledTraining,
  uploadCeuVoucher,
  validateDistrictWorkforceData,
  validatePlanningSession,
  WorkforceEntityType,
  WorkforceListFilters,
  GenerateWorkforceDocPackRequest,
  ScheduledTrainingFilters,
  TrainingCourseFilters,
} from '@/services/workforceSuccessionService';

export const workforceKeys = {
  continuity: (districtCode: string) =>
    ['workforce-succession', 'continuity', districtCode] as const,
  scorecards: (districtCodes?: string[]) =>
    ['workforce-succession', 'scorecards', districtCodes ?? 'all'] as const,
  batches: (districtCode: string) => ['workforce-succession', 'batches', districtCode] as const,
  planningSession: (districtCode: string) =>
    ['workforce-succession', 'planning-session', districtCode] as const,
  entities: (entity: WorkforceEntityType, districtCode: string, filters?: WorkforceListFilters) =>
    ['workforce-succession', 'entities', entity, districtCode, filters] as const,
  ceuRecords: (districtCode: string, filters?: { employee_code?: string; q?: string }) =>
    ['workforce-succession', 'ceu-records', districtCode, filters] as const,
  ceuSummary: (districtCode: string) =>
    ['workforce-succession', 'ceu-summary', districtCode] as const,
  ceuVouchers: (districtCode: string, recordId: number) =>
    ['workforce-succession', 'ceu-vouchers', districtCode, recordId] as const,
  districtEmployerProfile: (districtCode: string) =>
    ['workforce-succession', 'district-employer-profile', districtCode] as const,
  trainingCourses: (filters?: TrainingCourseFilters) =>
    ['workforce-succession', 'training-courses', filters ?? {}] as const,
  ceuRequirements: () => ['workforce-succession', 'ceu-requirements'] as const,
  scheduledTrainings: (filters: ScheduledTrainingFilters) =>
    ['workforce-succession', 'scheduled-trainings', filters] as const,
  widgetSummary: (districtCode: string) =>
    ['workforce-succession', 'widget-summary', districtCode] as const,
  binder: (districtCode: string) => ['workforce-succession', 'binder', districtCode] as const,
  binderIntake: (districtCode: string) =>
    ['workforce-succession', 'binder-intake', districtCode] as const,
};

export function useWorkforceBinder(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.binder(districtCode ?? ''),
    queryFn: () => fetchWorkforceBinder(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 30 * 1000,
  });
}

export function useGenerateWorkforceDocPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      districtCode,
      body,
    }: {
      districtCode: string;
      body?: GenerateWorkforceDocPackRequest;
    }) => generateWorkforceDocumentationPack(districtCode, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: workforceKeys.binder(vars.districtCode) });
    },
  });
}

export function useBinderIntakeSession(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.binderIntake(districtCode ?? ''),
    queryFn: () => fetchBinderIntake(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 15 * 1000,
  });
}

export function useEnsureBinderIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (districtCode: string) => ensureBinderIntake(districtCode),
    onSuccess: (_data, districtCode) => {
      qc.invalidateQueries({ queryKey: workforceKeys.binderIntake(districtCode) });
    },
  });
}

export function usePatchBinderIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      districtCode,
      body,
    }: {
      sessionId: number;
      districtCode: string;
      body: Parameters<typeof patchBinderIntake>[1];
    }) => patchBinderIntake(sessionId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: workforceKeys.binderIntake(vars.districtCode) });
    },
  });
}

export function useCompleteBinderIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      districtCode,
    }: {
      sessionId: number;
      districtCode: string;
    }) => completeBinderIntake(sessionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: workforceKeys.binderIntake(vars.districtCode) });
      qc.invalidateQueries({ queryKey: workforceKeys.binder(vars.districtCode) });
    },
  });
}

export function useAbandonBinderIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      districtCode,
    }: {
      sessionId: number;
      districtCode: string;
    }) => abandonBinderIntake(sessionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: workforceKeys.binderIntake(vars.districtCode) });
    },
  });
}

export function useWorkforceContinuity(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.continuity(districtCode ?? ''),
    queryFn: () => fetchWorkforceContinuity(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 60 * 1000,
  });
}

export function useWorkforceScorecards(districtCodes?: string[]) {
  return useQuery({
    queryKey: workforceKeys.scorecards(districtCodes),
    queryFn: () => fetchWorkforceScorecards(districtCodes),
    staleTime: 60 * 1000,
  });
}

export function useWorkforceImportBatches(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.batches(districtCode ?? ''),
    queryFn: () => fetchImportBatches(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 30 * 1000,
  });
}

export function usePreviewWorkforceImport() {
  return useMutation({ mutationFn: previewWorkforceImport });
}

export function useCommitWorkforceImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commitWorkforceImport,
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['workforce-succession'] });
      return result;
    },
  });
}

export function useDownloadCsvTemplate() {
  return useMutation({
    mutationFn: (entity: WorkforceEntityType) => downloadCsvTemplate(entity),
  });
}

export function useTriggerWorkforceAlertScan() {
  return useMutation({
    mutationFn: (districtCode: string) => triggerWorkforceAlertScan(districtCode),
  });
}

export function useWorkforcePlanningSession(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.planningSession(districtCode ?? ''),
    queryFn: () => fetchPlanningSession(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 15 * 1000,
  });
}

export function useWorkforceWidgetSummary(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.widgetSummary(districtCode ?? ''),
    queryFn: () => fetchWorkforceWidgetSummary(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 60 * 1000,
  });
}

export function useEnsurePlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ensurePlanningSession,
    onSuccess: res => {
      qc.invalidateQueries({
        queryKey: workforceKeys.planningSession(res.session.district_code),
      });
    },
  });
}

export function usePatchPlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      body,
    }: {
      sessionId: number;
      body: Parameters<typeof patchPlanningSession>[1];
    }) => patchPlanningSession(sessionId, body),
    onSuccess: row => {
      qc.invalidateQueries({
        queryKey: workforceKeys.planningSession(row.district_code),
      });
      qc.invalidateQueries({ queryKey: ['workforce-succession'] });
    },
  });
}

export function useValidatePlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: validatePlanningSession,
    onSuccess: (_, sessionId) => {
      qc.invalidateQueries({ queryKey: ['workforce-succession', 'planning-session'] });
      qc.invalidateQueries({ queryKey: ['workforce-succession', sessionId] });
    },
  });
}

export function usePublishPlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishPlanningSession,
    onSuccess: res => {
      qc.invalidateQueries({
        queryKey: workforceKeys.planningSession(res.district_code),
      });
      qc.invalidateQueries({ queryKey: ['workforce-succession'] });
    },
  });
}

export function useAbandonPlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: abandonPlanningSession,
    onSuccess: row => {
      qc.invalidateQueries({
        queryKey: workforceKeys.planningSession(row.district_code),
      });
    },
  });
}

export function useValidateDistrictWorkforceData() {
  return useMutation({
    mutationFn: validateDistrictWorkforceData,
  });
}

export function useWorkforceEntityList(
  districtCode: string | undefined,
  entityType: WorkforceEntityType,
  filters?: WorkforceListFilters
) {
  return useQuery({
    queryKey: workforceKeys.entities(entityType, districtCode ?? '', filters),
    queryFn: () => fetchWorkforceEntities(entityType, districtCode as string, filters),
    enabled: Boolean(districtCode),
    staleTime: 30 * 1000,
  });
}

export function useCreateWorkforceEntity(entityType: WorkforceEntityType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => createWorkforceEntity(entityType, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useUpdateWorkforceEntity(entityType: WorkforceEntityType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      districtCode,
      body,
    }: {
      id: number;
      districtCode: string;
      body: Record<string, unknown>;
    }) => updateWorkforceEntity(entityType, id, districtCode, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useDeleteWorkforceEntity(entityType: WorkforceEntityType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, districtCode }: { id: number; districtCode: string }) =>
      deleteWorkforceEntity(entityType, id, districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useCeuSummary(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.ceuSummary(districtCode ?? ''),
    queryFn: () => fetchCeuSummary(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 60 * 1000,
  });
}

export function useCeuRecords(
  districtCode: string | undefined,
  filters?: { employee_code?: string; q?: string }
) {
  return useQuery({
    queryKey: workforceKeys.ceuRecords(districtCode ?? '', filters),
    queryFn: () => fetchCeuRecords(districtCode as string, filters),
    enabled: Boolean(districtCode),
    staleTime: 30 * 1000,
  });
}

export function useCreateCeuRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCeuRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useDeleteCeuRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { recordId: number; districtCode: string }) =>
      deleteCeuRecord(params.recordId, params.districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useUploadCeuVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadCeuVoucher,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useCeuVouchers(districtCode: string | undefined, recordId: number | undefined) {
  return useQuery({
    queryKey: workforceKeys.ceuVouchers(districtCode ?? '', recordId ?? 0),
    queryFn: () => fetchCeuVouchers(recordId as number, districtCode as string),
    enabled: Boolean(districtCode && recordId),
    staleTime: 30 * 1000,
  });
}

export function useDeleteCeuVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { voucherId: number; districtCode: string }) =>
      deleteCeuVoucher(params.voucherId, params.districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useDistrictEmployerProfile(districtCode: string | undefined) {
  return useQuery({
    queryKey: workforceKeys.districtEmployerProfile(districtCode ?? ''),
    queryFn: () => fetchDistrictEmployerProfile(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 60 * 1000,
  });
}

export function useUpdateDistrictEmployerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      districtCode: string;
      body: { mailing_address_line1?: string | null; mailing_address_line2?: string | null };
    }) => updateDistrictEmployerProfile(params.districtCode, params.body),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: workforceKeys.districtEmployerProfile(vars.districtCode),
      }),
  });
}

export function useTrainingCourses(filters?: TrainingCourseFilters) {
  return useQuery({
    queryKey: workforceKeys.trainingCourses(filters),
    queryFn: () => fetchTrainingCourses(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTriggerTrainingScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerTrainingScrape,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['workforce-succession', 'training-courses'] }),
  });
}

export function useCeuRequirements() {
  return useQuery({
    queryKey: workforceKeys.ceuRequirements(),
    queryFn: fetchCeuRequirements,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useScheduledTrainings(filters: ScheduledTrainingFilters | undefined) {
  return useQuery({
    queryKey: workforceKeys.scheduledTrainings(filters ?? { district_code: '' }),
    queryFn: () => fetchScheduledTrainings(filters as ScheduledTrainingFilters),
    enabled: Boolean(filters?.district_code),
    staleTime: 30 * 1000,
  });
}

export function useCreateScheduledTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createScheduledTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useCreateTrainingFromCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ districtCode, courseId }: { districtCode: string; courseId: number }) =>
      createTrainingFromCourse(districtCode, courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useUpdateScheduledTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      districtCode,
      body,
    }: {
      id: number;
      districtCode: string;
      body: Parameters<typeof updateScheduledTraining>[2];
    }) => updateScheduledTraining(id, districtCode, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useDeleteScheduledTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, districtCode }: { id: number; districtCode: string }) =>
      deleteScheduledTraining(id, districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useEnrollInScheduledTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, districtCode }: { id: number; districtCode: string }) =>
      enrollInScheduledTraining(id, districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useCancelTrainingEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, districtCode }: { id: number; districtCode: string }) =>
      cancelTrainingEnrollment(id, districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}

export function useMyTrainingEnrollments(districtCode: string | undefined) {
  return useQuery({
    queryKey: ['workforce-succession', 'my-training-enrollments', districtCode],
    queryFn: () => fetchMyTrainingEnrollments(districtCode as string),
    enabled: Boolean(districtCode),
    staleTime: 30 * 1000,
  });
}

export function useSeedLearningStreamCourses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (districtCode?: string) => seedLearningStreamCourses(districtCode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workforce-succession'] }),
  });
}
