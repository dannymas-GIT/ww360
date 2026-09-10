import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorkforceEntity } from '@/hooks/useWorkforceSuccession';

interface Props {
  districtCode: string;
  employeeCode?: string;
}

/** Lightweight operator responsibility capture → knowledge_artifact row. */
export function WorkforceOperatorResponsibilityForm({ districtCode, employeeCode }: Props) {
  const create = useCreateWorkforceEntity('knowledge_artifacts');
  const [functionName, setFunctionName] = useState('');
  const [summary, setSummary] = useState('');
  const [tools, setTools] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    await create.mutateAsync({
      district_code: districtCode,
      artifact_type: 'training_note',
      title: functionName.trim() || 'My responsibility',
      summary: [summary, tools ? `Tools: ${tools}` : '', frequency ? `Frequency: ${frequency}` : '']
        .filter(Boolean)
        .join('\n'),
      function_code: functionName.trim(),
      ...(employeeCode ? { source_employee_code: employeeCode } : {}),
    });
    setSaved(true);
  };

  if (saved) {
    return (
      <p className="text-sm text-emerald-700">
        Saved. Your manager can link this to a tutorial recording from Document Studio.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <div>
        <Label htmlFor="fn">Function / responsibility</Label>
        <Input id="fn" value={functionName} onChange={e => setFunctionName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="what">What I do</Label>
        <Textarea id="what" value={summary} onChange={e => setSummary(e.target.value)} rows={3} />
      </div>
      <div>
        <Label htmlFor="tools">Tools & systems</Label>
        <Input id="tools" value={tools} onChange={e => setTools(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="freq">Frequency</Label>
        <Input id="freq" value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="Daily / weekly / on-call" />
      </div>
      <Button onClick={() => void onSave()} disabled={!functionName.trim() || create.isPending}>
        Save responsibility note
      </Button>
    </div>
  );
}
