import { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { WorkforceBinderProfile } from '@/services/workforceSuccessionService';

const PROFILE_OPTIONS: { id: WorkforceBinderProfile; label: string; hint: string }[] = [
  {
    id: 'small_system',
    label: 'Small system (single plant)',
    hint: 'Core succession sections — roles, retirement risk, bench, knowledge transfer.',
  },
  {
    id: 'multi_plant',
    label: 'Multi-plant utility',
    hint: 'Adds coverage matrix and board one-pager.',
  },
  {
    id: 'district_trainees',
    label: 'District with trainees',
    hint: 'Adds trainee pathway and board update sections.',
  },
];

export interface WorkforceBinderSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtLabel?: string;
  defaultContactName?: string;
  defaultContactEmail?: string;
  onSubmit: (values: {
    profile: WorkforceBinderProfile;
    contact_name: string;
    contact_email: string;
    use_live_data: boolean;
  }) => Promise<void>;
}

export function WorkforceBinderSetupDialog({
  open,
  onOpenChange,
  districtLabel,
  defaultContactName = '',
  defaultContactEmail = '',
  onSubmit,
}: WorkforceBinderSetupDialogProps) {
  const [profile, setProfile] = useState<WorkforceBinderProfile>('small_system');
  const [contactName, setContactName] = useState(defaultContactName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [useLiveData, setUseLiveData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedProfile = PROFILE_OPTIONS.find(p => p.id === profile);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        profile,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        use_live_data: useLiveData,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[1.25rem]">
            <BookOpen className="h-5 w-5 text-indigo-700" aria-hidden />
            Create Succession Binder
          </DialogTitle>
          <DialogDescription className="text-[1rem] leading-relaxed">
            {districtLabel
              ? `Build a Document Studio binder for ${districtLabel}.`
              : 'Build a Document Studio binder for your utility.'}{' '}
            Sections are prefilled from Continuity when available — edit in Document Studio, then
            export or transfer custody to your cloud storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="binder-profile" className="text-[1rem]">
              Utility template
            </Label>
            <Select value={profile} onValueChange={v => setProfile(v as WorkforceBinderProfile)}>
              <SelectTrigger id="binder-profile" className="min-h-[44px] text-[1rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-[1rem]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfile ? (
              <p className="text-[0.875rem] leading-relaxed text-slate-600">{selectedProfile.hint}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="binder-contact-name" className="text-[1rem]">
                Prepared by
              </Label>
              <Input
                id="binder-contact-name"
                className="min-h-[44px] text-[1rem]"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="District manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="binder-contact-email" className="text-[1rem]">
                Contact email
              </Label>
              <Input
                id="binder-contact-email"
                type="email"
                className="min-h-[44px] text-[1rem]"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="manager@utility.gov"
              />
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <Checkbox
              checked={useLiveData}
              onCheckedChange={v => setUseLiveData(v === true)}
              className="mt-1"
            />
            <span className="text-[1rem] leading-relaxed text-slate-800">
              Prefill from live Continuity data (coverage, retirement horizon, succession bench, CEU
              status). Leave unchecked to start with placeholders only.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] text-[1rem]"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-[44px] text-[1rem]"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creating binder…
              </>
            ) : (
              'Create binder in Document Studio'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
