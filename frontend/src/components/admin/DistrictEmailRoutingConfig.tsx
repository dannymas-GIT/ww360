import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  createMapping,
  deleteMapping,
  getDistrictEmailDomains,
  getMappings,
  patchDistrictEmailDomain,
  previewRouting,
  updateMapping,
  type EmailDistrictMappingRow,
} from '@/services/emailIngestionService';

const extractApiError = (e: unknown, fallback: string): string => {
  if (axios.isAxiosError(e)) {
    const detail = (e.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (e.message) return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
};

export interface DistrictEmailRoutingConfigProps {
  districtCode: string;
  districtName?: string;
  compact?: boolean;
  onConfiguredChange?: (configured: boolean) => void;
}

export const DistrictEmailRoutingConfig: React.FC<DistrictEmailRoutingConfigProps> = ({
  districtCode,
  districtName,
  compact = false,
  onConfiguredChange,
}) => {
  const normalizedDistrict = districtCode.trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainDraft, setDomainDraft] = useState('');
  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [domainSaving, setDomainSaving] = useState(false);

  const [mappings, setMappings] = useState<EmailDistrictMappingRow[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [mappingSaving, setMappingSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [previewText, setPreviewText] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    district_code: string | null;
    matched_recipient_keys: string[];
  } | null>(null);

  const isConfigured = useMemo(() => {
    const hasDomain = Boolean((savedDomain || '').trim());
    const hasActiveMapping = mappings.some(m => m.is_active);
    return hasDomain || hasActiveMapping;
  }, [savedDomain, mappings]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [domains, mappingRows] = await Promise.all([
        getDistrictEmailDomains(),
        getMappings(normalizedDistrict),
      ]);
      const row = domains.find(d => d.district_code === normalizedDistrict);
      const domain = row?.ingestion_email_domain ?? '';
      setDomainDraft(domain);
      setSavedDomain(row?.ingestion_email_domain ?? null);
      setMappings(mappingRows);
    } catch (e) {
      setError(extractApiError(e, 'Failed to load email routing settings'));
    } finally {
      setLoading(false);
    }
  }, [normalizedDistrict]);

  useEffect(() => {
    void load();
  }, [load]);

  // Notify parent only when configured status actually changes — avoid loops when
  // the parent passes an unstable inline callback that triggers a re-render.
  const lastConfiguredRef = useRef<{ district: string; value: boolean } | null>(null);
  useEffect(() => {
    if (loading) return;
    const prev = lastConfiguredRef.current;
    if (prev?.district === normalizedDistrict && prev.value === isConfigured) return;
    lastConfiguredRef.current = { district: normalizedDistrict, value: isConfigured };
    onConfiguredChange?.(isConfigured);
  }, [isConfigured, loading, normalizedDistrict, onConfiguredChange]);

  const saveDomain = async () => {
    setDomainSaving(true);
    setNotice(null);
    try {
      const trimmed = domainDraft.trim();
      const updated = await patchDistrictEmailDomain(normalizedDistrict, {
        ingestion_email_domain: trimmed === '' ? null : trimmed,
      });
      setSavedDomain(updated.ingestion_email_domain ?? null);
      setDomainDraft(updated.ingestion_email_domain ?? '');
      setNotice({ type: 'success', message: 'Lab email domain saved.' });
    } catch (e) {
      setNotice({ type: 'error', message: extractApiError(e, 'Failed to save domain') });
    } finally {
      setDomainSaving(false);
    }
  };

  const addMapping = async () => {
    setMappingSaving(true);
    setNotice(null);
    const email = newEmail.trim();
    if (!email) {
      setNotice({ type: 'error', message: 'Recipient email is required.' });
      setMappingSaving(false);
      return;
    }
    try {
      await createMapping({
        email_address: email,
        district_code: normalizedDistrict,
        description: newDescription.trim() || undefined,
        is_active: true,
      });
      setNewEmail('');
      setNewDescription('');
      setNotice({ type: 'success', message: `Mapping saved for ${email}.` });
      await load();
    } catch (e) {
      setNotice({ type: 'error', message: extractApiError(e, 'Failed to add mapping') });
    } finally {
      setMappingSaving(false);
    }
  };

  const startEdit = (row: EmailDistrictMappingRow) => {
    setEditingId(row.id);
    setEditEmail(row.email_address);
    setEditDescription(row.description ?? '');
    setEditActive(row.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEmail('');
    setEditDescription('');
    setEditActive(true);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    setMappingSaving(true);
    setNotice(null);
    try {
      await updateMapping(editingId, {
        email_address: editEmail.trim(),
        description: editDescription.trim() || null,
        is_active: editActive,
      });
      cancelEdit();
      setNotice({ type: 'success', message: 'Mapping updated.' });
      await load();
    } catch (e) {
      setNotice({ type: 'error', message: extractApiError(e, 'Failed to update mapping') });
    } finally {
      setMappingSaving(false);
    }
  };

  const removeMapping = async (id: number) => {
    if (!confirm('Delete this recipient mapping?')) return;
    setNotice(null);
    try {
      await deleteMapping(id);
      setNotice({ type: 'success', message: 'Mapping deleted.' });
      await load();
    } catch (e) {
      setNotice({ type: 'error', message: extractApiError(e, 'Failed to delete mapping') });
    }
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    setPreviewResult(null);
    setNotice(null);
    try {
      const result = await previewRouting({
        recipient_text: previewText,
        email_body: previewBody.trim() || undefined,
      });
      setPreviewResult(result);
    } catch (e) {
      setNotice({ type: 'error', message: extractApiError(e, 'Routing preview failed') });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading email routing…</div>;
  }

  return (
    <div className={`space-y-6 ${compact ? '' : ''}`}>
      <div>
        <h3 className="text-base font-semibold text-slate-800">
          Lab email routing{districtName ? ` — ${districtName}` : ''}
        </h3>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Configure how inbound lab emails route to <strong>{normalizedDistrict}</strong>. Exact
          recipient mappings take priority; otherwise any address at the configured domain matches.
          Paste semicolon-separated recipient lists (as they appear in forwarded mail) in the test
          helper below.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {notice && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="status"
        >
          {notice.message}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-white">
        <div>
          <Label htmlFor={`domain-${normalizedDistrict}`}>Lab email domain</Label>
          <p className="text-xs text-slate-500 mt-1">
            Example: <code className="bg-slate-100 px-1 rounded">westhempsteadwater.org</code> (no
            @). Any To/CC address at this domain routes here when no exact mapping exists.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id={`domain-${normalizedDistrict}`}
            className="max-w-md font-mono"
            placeholder="district.org"
            value={domainDraft}
            onChange={e => setDomainDraft(e.target.value)}
            disabled={domainSaving}
          />
          <Button
            type="button"
            onClick={() => void saveDomain()}
            disabled={domainSaving || domainDraft.trim() === (savedDomain ?? '').trim()}
          >
            {domainSaving ? 'Saving…' : 'Save domain'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-white">
        <div>
          <Label>Recipient address mappings</Label>
          <p className="text-xs text-slate-500 mt-1">
            Add district staff or shared inboxes that appear on lab result emails (e.g.{' '}
            <code className="bg-slate-100 px-1 rounded">maris@westhempsteadwater.org</code>).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-[220px] flex-1 font-mono text-sm"
            placeholder="recipient@district.org"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <Input
            className="min-w-[180px] flex-1 text-sm"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
          />
          <Button type="button" onClick={() => void addMapping()} disabled={mappingSaving}>
            {mappingSaving ? 'Saving…' : 'Add mapping'}
          </Button>
        </div>

        {mappings.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No recipient mappings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600 border-b">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(row =>
                  editingId === row.id ? (
                    <tr key={row.id} className="border-b align-top">
                      <td className="py-2 pr-3">
                        <Input
                          className="font-mono text-sm"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          className="text-sm"
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Switch checked={editActive} onCheckedChange={setEditActive} />
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={() => void saveEdit()}
                          disabled={mappingSaving}
                        >
                          Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b align-top">
                      <td className="py-2 pr-3 font-mono">{row.email_address}</td>
                      <td className="py-2 pr-3 text-slate-600">{row.description || '—'}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs rounded border ${
                            row.is_active
                              ? 'bg-green-50 text-green-800 border-green-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {row.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mr-2"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-700"
                          onClick={() => void removeMapping(row.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/60">
        <div>
          <Label htmlFor={`preview-${normalizedDistrict}`}>Test routing</Label>
          <p className="text-xs text-slate-500 mt-1">
            Paste a To/Cc line from a forwarded lab email. Semicolons and display names are OK.
          </p>
        </div>
        <Textarea
          id={`preview-${normalizedDistrict}`}
          rows={3}
          className="font-mono text-sm"
          placeholder="; maris@westhempsteadwater.org ; jbelle@westhempsteadwater.org ;"
          value={previewText}
          onChange={e => setPreviewText(e.target.value)}
        />
        {!compact && (
          <Textarea
            rows={4}
            className="font-mono text-sm"
            placeholder="Optional forwarded body (To:/Cc: block from Outlook/Gmail forward)"
            value={previewBody}
            onChange={e => setPreviewBody(e.target.value)}
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runPreview()}
            disabled={previewLoading}
          >
            {previewLoading ? 'Testing…' : 'Preview district match'}
          </Button>
          {previewResult && (
            <div className="text-sm">
              {previewResult.district_code ? (
                <span className="text-green-800 font-medium">
                  Routes to {previewResult.district_code}
                  {previewResult.matched_recipient_keys.length > 0
                    ? ` (${previewResult.matched_recipient_keys.join(', ')})`
                    : ''}
                </span>
              ) : (
                <span className="text-orange-800 font-medium">No district match</span>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Status:{' '}
        {isConfigured ? 'Routing configured' : 'Not configured — add a domain and/or mapping'}
      </p>
    </div>
  );
};

export default DistrictEmailRoutingConfig;
