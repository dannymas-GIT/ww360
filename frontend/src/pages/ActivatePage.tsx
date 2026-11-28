import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/constants';
import {
  AUTH_TOKEN_KEY,
  completeSsoCallback,
  fetchSsoProviders,
  getSsoAuthUrl,
  SSO_PENDING_KEY,
  type SsoProviderId,
} from '@/services/authService';
import { getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';

type Step = 'identify' | 'verify' | 'claim' | 'link' | 'pwsid' | 'done';

export default function ActivatePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { applySessionUser, isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>('identify');
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [stateCode, setStateCode] = useState('NY');
  const [billingEmail, setBillingEmail] = useState('');
  const [pwsid, setPwsid] = useState('');
  const [orgCode, setOrgCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<Array<{ id: SsoProviderId; label: string }>>(
    []
  );
  const [devHint, setDevHint] = useState<string | null>(null);

  useEffect(() => {
    void fetchSsoProviders().then(setSsoProviders);
  }, []);

  // Deep-link: magic token or approve_link
  useEffect(() => {
    const token = params.get('token');
    const approve = params.get('approve_link');
    const requestId = params.get('request_id');
    if (approve && requestId) {
      setBusy(true);
      void axios
        .post(`${API_BASE_URL}/auth/activate/approve-link`, {
          request_id: requestId,
          approval_token: approve,
        })
        .then(({ data }) => {
          if (data.access_token) {
            localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
            applySessionUser(data.user);
            setOrgCode(data.org_code);
            setStep('pwsid');
          } else {
            setMessage('Link approved. Continue with your email to finish setup.');
            setStep('identify');
          }
        })
        .catch(() => setError('Approval link is invalid or expired.'))
        .finally(() => setBusy(false));
      return;
    }
    if (token && email) {
      setBusy(true);
      void axios
        .post(`${API_BASE_URL}/auth/magic-link/verify`, { email, token })
        .then(({ data }) => {
          setEmail(data.email || email);
          if (data.entitlement_match?.matched) {
            setStep('claim');
          } else {
            setStep('link');
          }
        })
        .catch(() => setError('Activation link is invalid or expired.'))
        .finally(() => setBusy(false));
    }
    if (params.get('session_id')) {
      setStep('claim');
    }
  }, [applySessionUser, email, params]);

  // SSO return on /activate
  useEffect(() => {
    const code = params.get('code');
    if (!code) return;
    const raw = sessionStorage.getItem(SSO_PENDING_KEY);
    if (!raw) return;
    let pending: { provider: SsoProviderId; redirectUri: string };
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    sessionStorage.removeItem(SSO_PENDING_KEY);
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    next.delete('session_state');
    setParams(next, { replace: true });
    setBusy(true);
    void completeSsoCallback({
      provider: pending.provider,
      code,
      redirectUri: pending.redirectUri,
    })
      .then(data => {
        if ((data as { activate_required?: boolean }).activate_required) {
          const d = data as {
            email: string;
            full_name?: string;
            entitlement_match?: { matched?: boolean };
          };
          setEmail(d.email);
          setFullName(d.full_name || '');
          setStep(d.entitlement_match?.matched ? 'claim' : 'link');
          return;
        }
        if (data.access_token && data.user) {
          applySessionUser(data.user);
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => setError('SSO sign-in failed'))
      .finally(() => setBusy(false));
  }, [applySessionUser, navigate, params, setParams]);

  const startSso = useCallback(async (provider: SsoProviderId) => {
    setError('');
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/activate`;
      sessionStorage.setItem(SSO_PENDING_KEY, JSON.stringify({ provider, redirectUri }));
      const { auth_url } = await getSsoAuthUrl(provider, redirectUri, `activate|${provider}`);
      window.location.href = auth_url;
    } catch {
      setError('Could not start SSO.');
      setBusy(false);
    }
  }, []);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/magic-link/request`, { email });
      setMessage(data.message || 'Check your email for a code.');
      if (data.dev_otp) setDevHint(`Dev OTP: ${data.dev_otp}`);
      setStep('verify');
    } catch {
      setError('Could not send code. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/magic-link/verify`, {
        email,
        otp,
      });
      if (data.entitlement_match?.matched) setStep('claim');
      else setStep('link');
    } catch {
      setError('Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  const claim = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/activate/claim`, {
        email,
        full_name: fullName || undefined,
        org_name: orgName || undefined,
        state_code: stateCode,
        session_id: params.get('session_id') || undefined,
      });
      if (data.access_token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
        applySessionUser(data.user);
      }
      setOrgCode(data.org_code);
      setStep('pwsid');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      if (typeof detail === 'object' && detail && (detail as { code?: string }).code === 'entitlement_not_found') {
        setStep('link');
      } else {
        setError('Could not claim membership. Check your email or request a billing link.');
      }
    } finally {
      setBusy(false);
    }
  };

  const requestLink = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/activate/request-link`, {
        requester_email: email,
        billing_email: billingEmail || undefined,
        pwsid: pwsid || undefined,
        state_code: stateCode,
      });
      setMessage(data.message);
      if (data.dev_approval_token) {
        setDevHint(`Dev approval token: ${data.dev_approval_token} / ${data.dev_request_id}`);
      }
      setStep('done');
    } catch {
      setError('Could not submit link request.');
    } finally {
      setBusy(false);
    }
  };

  const linkPwsid = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgCode) {
      setError('Missing organization. Complete claim first.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/org/districts/link`,
        {
          org_code: orgCode,
          pwsid,
          state_code: stateCode,
          district_name: orgName || undefined,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}` } }
      );
      if (data.queued) {
        setMessage(data.message);
        setStep('done');
      } else {
        navigate('/district/users', { replace: true });
      }
    } catch {
      setError('Could not link PWSID. You can finish this later from Facilities.');
    } finally {
      setBusy(false);
    }
  };

  if (isAuthenticated && step === 'identify' && !params.get('code') && !params.get('token')) {
    // Already signed in — jump to PWSID if they landed here mid-onboarding
  }

  const logo = getWw360LogoPath('dark');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#07111f] via-[#0c1a2e] to-[#EEF3F9]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <img
            src={logo}
            alt="Water Workforce 360"
            className="mx-auto mb-4"
            style={{ height: WW360_LOGO_SIZE.navPx }}
          />
          <h1 className="font-[Sora,sans-serif] text-3xl font-semibold text-white">
            Activate your utility
          </h1>
          <p className="mt-2 text-lg text-slate-200">
            Verify your email, claim your OWW membership, then link your PWSID and invite staff.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-base text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-base text-sky-900">{message}</p>
          ) : null}
          {devHint ? (
            <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{devHint}</p>
          ) : null}

          {step === 'identify' && (
            <form onSubmit={e => void requestCode(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Work or billing email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="min-h-[44px] text-base"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
                Email me a code
              </Button>
              {ssoProviders.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-slate-600">Or continue with</p>
                  {ssoProviders.map(p => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="min-h-[44px] w-full text-base"
                      onClick={() => void startSso(p.id)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              )}
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={e => void verifyCode(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-base">
                  6-digit code
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="min-h-[44px] text-base tracking-widest"
                />
              </div>
              <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
                Verify
              </Button>
            </form>
          )}

          {step === 'claim' && (
            <form onSubmit={e => void claim(e)} className="space-y-4">
              <p className="text-lg text-slate-700">
                We found an OWW membership for <strong>{email}</strong>. Confirm your details to
                become the first district admin.
              </p>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-base">
                  Your name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="min-h-[44px] text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgName" className="text-base">
                  Utility name
                </Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="min-h-[44px] text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-base">
                  State
                </Label>
                <Input
                  id="state"
                  value={stateCode}
                  maxLength={2}
                  onChange={e => setStateCode(e.target.value.toUpperCase())}
                  className="min-h-[44px] text-base"
                />
              </div>
              <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
                Claim membership
              </Button>
            </form>
          )}

          {step === 'link' && (
            <form onSubmit={e => void requestLink(e)} className="space-y-4">
              <p className="text-lg text-slate-700">
                We could not match <strong>{email}</strong> to a Stripe billing contact. Enter the
                treasurer / AP email or your EPA PWSID to request linking — we never reveal whether
                an email exists in Stripe.
              </p>
              <div className="space-y-2">
                <Label htmlFor="billing" className="text-base">
                  Billing email (optional)
                </Label>
                <Input
                  id="billing"
                  type="email"
                  value={billingEmail}
                  onChange={e => setBillingEmail(e.target.value)}
                  className="min-h-[44px] text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwsidLink" className="text-base">
                  PWSID (optional)
                </Label>
                <Input
                  id="pwsidLink"
                  value={pwsid}
                  onChange={e => setPwsid(e.target.value.toUpperCase())}
                  className="min-h-[44px] text-base"
                />
              </div>
              <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
                Request link
              </Button>
            </form>
          )}

          {step === 'pwsid' && (
            <form onSubmit={e => void linkPwsid(e)} className="space-y-4">
              <p className="text-lg text-slate-700">
                Link your SDWIS public water system ID, then invite operators from Users &amp;
                access.
              </p>
              <div className="space-y-2">
                <Label htmlFor="pwsid" className="text-base">
                  EPA PWSID
                </Label>
                <Input
                  id="pwsid"
                  required
                  value={pwsid}
                  onChange={e => setPwsid(e.target.value.toUpperCase())}
                  className="min-h-[44px] text-base"
                  placeholder="NY1234567"
                />
              </div>
              <Button type="submit" disabled={busy} className="min-h-[44px] w-full text-base">
                Link PWSID &amp; continue
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full text-base"
                onClick={() => navigate('/district/users')}
              >
                Skip for now — invite staff
              </Button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <p className="text-lg text-slate-700">
                {message ||
                  'Your request was submitted. Check your email for next steps, or sign in once approved.'}
              </p>
              <Button asChild className="min-h-[44px] w-full text-base">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-base text-slate-200">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sky-200 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
