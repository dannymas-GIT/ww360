import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '@/lib/ga4';
import { API_BASE_URL } from '@/lib/constants';

type FormState = {
  full_name: string;
  email: string;
  organization: string;
  phone: string;
  title: string;
  message: string;
  company_website: string;
};

const EMPTY: FormState = {
  full_name: '',
  email: '',
  organization: '',
  phone: '',
  title: '',
  message: '',
  company_website: '',
};

/**
 * Public district access request form — posts to /api/v1/public/ww360/access-request.
 */
const Workforce360AccessForm: React.FC = () => {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/public/ww360/access-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        previewHtml?: string | null;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.detail === 'string' ? data.detail : 'Could not submit request.'
        );
      }
      setSent(true);
      setEmailDelivered(Boolean(data.sent));
      setPreviewHtml(data.previewHtml || null);
      setForm(EMPTY);
      trackEvent('access_request_submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="ww360-access">
        <div className="ww360-access__success" role="status">
          <h3>Enrollment request received</h3>
          <p>
            {emailDelivered
              ? 'Thanks — your Water Workforce 360 enrollment request is on its way to the partnership team. We’ll follow up at the email you provided to discuss your utility’s workforce planning needs.'
              : 'Thanks — your request was recorded. If email delivery is still being configured on this environment, use “View email” below to see the message that would be sent.'}
          </p>
          <div className="ww360-access__success-actions">
            {previewHtml ? (
              <button
                type="button"
                className="ww360-btn ww360-btn--ghost"
                onClick={() => setShowPreview(v => !v)}
              >
                {showPreview ? 'Hide email' : 'View email'}
              </button>
            ) : null}
            <Link className="ww360-btn ww360-btn--primary" to="/login">
              Log in
            </Link>
          </div>
          {showPreview && previewHtml ? (
            <iframe
              className="ww360-access__preview"
              title="Access request email preview"
              srcDoc={previewHtml}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form className="ww360-access" onSubmit={onSubmit} noValidate>
      <p className="ww360-access__intro">
        Water Workforce 360 helps utilities document employer-side workforce intelligence — current
        staffing, vacancies, anticipated retirements, succession risks, critical positions, and
        training or certification needs. Share what you can below; the partnership team will follow
        up to complete enrollment.
      </p>
      <div className="ww360-access__grid">
        <label className="ww360-access__field">
          <span>Full name *</span>
          <input
            name="full_name"
            autoComplete="name"
            required
            value={form.full_name}
            onChange={onChange('full_name')}
          />
        </label>
        <label className="ww360-access__field">
          <span>Work email *</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={onChange('email')}
          />
        </label>
        <label className="ww360-access__field">
          <span>Organization / district *</span>
          <input
            name="organization"
            autoComplete="organization"
            required
            value={form.organization}
            onChange={onChange('organization')}
          />
        </label>
        <label className="ww360-access__field">
          <span>Title / role</span>
          <input
            name="title"
            autoComplete="organization-title"
            value={form.title}
            onChange={onChange('title')}
          />
        </label>
        <label className="ww360-access__field">
          <span>Phone</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={onChange('phone')}
          />
        </label>
        {/* Honeypot */}
        <label className="ww360-access__hp" aria-hidden="true">
          <span>Company website</span>
          <input
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            value={form.company_website}
            onChange={onChange('company_website')}
          />
        </label>
        <label className="ww360-access__field ww360-access__field--full">
          <span>Workforce planning context</span>
          <textarea
            name="message"
            rows={5}
            value={form.message}
            onChange={onChange('message')}
            placeholder="Helpful details: operator/staff count; current or anticipated vacancies; expected retirements in the next 12 months or 2–5 years; succession risks or critical positions; recruitment challenges; training or certification gaps; timeline for joining Workforce 360."
          />
        </label>
      </div>

      {error ? (
        <p className="ww360-access__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ww360-access__actions">
        <button
          type="submit"
          className="ww360-btn ww360-btn--primary"
          disabled={submitting}
        >
          {submitting ? 'Sending…' : 'Join Water Workforce 360'}
        </button>
        <Link className="ww360-btn ww360-btn--ghost" to="/login">
          Log in
        </Link>
      </div>
      <p className="ww360-access__note">
        Information is used only to follow up about Water Workforce 360 enrollment and workforce
        planning. Individual utility data is handled confidentially; aggregated insights may inform
        regional One Water Workforce strategies.
      </p>
    </form>
  );
};

export default Workforce360AccessForm;
