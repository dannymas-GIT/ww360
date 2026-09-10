import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkforceTrainingArea } from './WorkforceTrainingArea';

const mockUseTrainingCourses = vi.fn();
const mockUseTriggerTrainingScrape = vi.fn();

vi.mock('@/hooks/useWorkforceSuccession', () => ({
  useTrainingCourses: (...args: unknown[]) => mockUseTrainingCourses(...args),
  useTriggerTrainingScrape: () => mockUseTriggerTrainingScrape(),
  useCreateTrainingFromCourse: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const sampleCourse = {
  id: 1,
  state: 'NY',
  source: 'NYSDOH',
  cert_program: 'drinking_water',
  cert_type: 'distribution',
  course_category: 'renewal',
  sponsor: 'JCC',
  course_name: 'Grade D Renewal',
  grade: 'D',
  start_date: '2026-06-16',
  end_date: '2026-06-18',
  cost_text: '$725',
  cost_amount: 725,
  contact_name: null,
  contact_email: 'workforce@example.com',
  contact_phone: '(716) 363-6585',
  source_url: 'https://example.test',
  source_anchor: null,
  is_active: true,
  last_seen_at: '2026-06-13T12:00:00Z',
  description: 'Renewal distribution training',
  location_text: 'Jamestown, NY',
  delivery_mode: 'in_person',
  contact_hours: 24,
};

function renderArea(initialFilters?: Parameters<typeof WorkforceTrainingArea>[0]['initialFilters']) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <WorkforceTrainingArea initialFilters={initialFilters} />
    </QueryClientProvider>
  );
}

describe('WorkforceTrainingArea', () => {
  beforeEach(() => {
    mockUseTrainingCourses.mockReturnValue({
      data: {
        courses: [sampleCourse],
        total: 1,
        last_synced_at: '2026-06-13T12:00:00Z',
      },
      isLoading: false,
    });
    mockUseTriggerTrainingScrape.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders course rows from the catalog query', () => {
    renderArea({ course_category: 'renewal', grade: 'D' });
    expect(screen.getByText('Grade D Renewal')).toBeInTheDocument();
    expect(screen.getByText('JCC')).toBeInTheDocument();
    expect(screen.getByText('Refresh from DOH')).toBeInTheDocument();
  });

  it('shows not-yet-scraped message when catalog has never synced', () => {
    mockUseTrainingCourses.mockReturnValue({
      data: { courses: [], total: 0, last_synced_at: null },
      isLoading: false,
    });
    renderArea();
    expect(
      screen.getByText(
        'Catalog not yet synced from NYSDOH. Click Refresh from DOH to load courses.'
      )
    ).toBeInTheDocument();
  });

  it('shows filter message when synced catalog has no matching courses', () => {
    mockUseTrainingCourses.mockReturnValue({
      data: { courses: [], total: 0, last_synced_at: '2026-06-13T12:00:00Z' },
      isLoading: false,
    });
    renderArea();
    expect(
      screen.getByText(
        'No courses match these filters. Try broadening your search or use All dates.'
      )
    ).toBeInTheDocument();
  });
});
