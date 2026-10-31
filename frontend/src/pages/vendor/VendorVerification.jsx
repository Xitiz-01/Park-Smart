import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileCheck2, Landmark, ShieldCheck, Upload, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { verificationAPI, vendorsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { cn } from '@/lib/utils';
import {
  AUTHORIZATION_TYPES, DOCUMENT_TYPES, VENDOR_CHECKS, VERIFICATION_PROVIDERS, verificationLabel,
} from '@/lib/verification';

const CHECK_ICONS = { identityStatus: ShieldCheck, businessStatus: FileCheck2, bankStatus: WalletCards };
const FILE_TYPES = 'application/pdf,image/jpeg,image/png';

// One consent row, the same size everywhere (the two used to differ: audit M2).
function ConsentRow({ checked, onChange, disabled, children }) {
  return (
    <label className={cn('flex items-start gap-3 rounded-lg bg-surface-sunken p-3 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <Checkbox className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      <span>{children}</span>
    </label>
  );
}

// A file input that says what is picked, and that it stays private.
function FilePicker({ label, file, onChange }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}<span aria-hidden="true" className="text-text-muted"> *</span></label>
      <input
        id={id}
        type="file"
        accept={FILE_TYPES}
        required
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.files[0] || null)}
        className="block w-full cursor-pointer rounded-lg border border-input bg-surface-raised text-sm text-text-muted file:mr-3 file:cursor-pointer file:border-0 file:border-r file:bg-surface-sunken file:px-3 file:py-2.5 file:text-sm file:font-medium file:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
      />
      <p id={`${id}-hint`} className="text-sm text-text-muted">
        {file ? <>Selected: <span className="font-medium text-foreground">{file.name}</span></> : 'PDF, JPEG or PNG, up to 5 MB. Stored privately; only reviewers can open it.'}
      </p>
    </div>
  );
}

function Panel({ id, title, description, children, className }) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-2xl border bg-card p-5 shadow-hairline sm:p-6', className)}>
      <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EvidenceList({ items, empty, describe }) {
  if (!items?.length) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {items.map((item) => {
        const reason = item.rejectionReason || item.resubmissionReason;
        return (
          <li key={item._id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg bg-surface-sunken p-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{describe(item)}</span>
              {reason && <span className="mt-1 block text-slot-reserved">Action needed: {reason}</span>}
            </span>
            <StatusBadge status={item.status} />
          </li>
        );
      })}
    </ul>
  );
}

// Provider cards come from VERIFICATION_PROVIDERS in lib/verification.js.
function ProviderCard({ provider, available, busy, onCheck }) {
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({ kind: provider.checks?.[0] || '', identifier: '', name: '' });

  const submit = async (event) => {
    event.preventDefault();
    const ok = await onCheck(form.kind, { identifier: form.identifier, name: form.name, businessName: form.name, consent });
    if (ok) { setForm((value) => ({ ...value, identifier: '' })); setConsent(false); }
  };

  return (
    <article className="rounded-xl border bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium">{provider.name}</h3>
        <StatusBadge tone={available ? 'success' : 'neutral'}>{available ? 'Available' : 'Not available yet'}</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-text-muted">{available ? provider.summary : provider.unavailable}</p>
      {available && (
        <form onSubmit={submit} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <FormField label="Check">
              <NativeSelect className="w-full" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                {provider.checks.map((check) => <NativeSelectOption key={check} value={check}>{verificationLabel(check)}</NativeSelectOption>)}
              </NativeSelect>
            </FormField>
            <FormField label={`${verificationLabel(form.kind)} number`} required>
              <Input className="font-mono uppercase" autoComplete="off" spellCheck={false} value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
            </FormField>
            <FormField label="Name or business name" required className="sm:col-span-2">
              <Input autoComplete="organization" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
          </div>
          <ConsentRow checked={consent} onChange={setConsent}>{provider.consent}</ConsentRow>
          <div>
            <Button type="submit" variant="outline" disabled={busy || !consent}>
              {busy && <Spinner data-icon="inline-start" />}
              {provider.action}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function VendorVerification() {
  const [data, setData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [category, setCategory] = useState('IDENTITY');
  const [documentType, setDocumentType] = useState('PAN');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [authLocation, setAuthLocation] = useState('');
  const [authType, setAuthType] = useState('OWNERSHIP_PROOF');
  const [authFile, setAuthFile] = useState(null);
  const [authConsent, setAuthConsent] = useState(false);
  const [formKeys, setFormKeys] = useState({ document: 0, authorization: 0 });

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [verification, parking] = await Promise.all([verificationAPI.getMine(), vendorsAPI.getLocations()]);
      setData(verification.data);
      setLocations(parking.data.locations || []);
      setAuthLocation((value) => value || parking.data.locations?.[0]?._id || '');
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const verification = data?.verification || {};
  const progress = useMemo(() => VENDOR_CHECKS.filter((check) => verification[check.key] === 'VERIFIED').length, [verification]);
  const authorizationStatus = data?.parkingAuthorizations?.some((item) => item.status === 'VERIFIED') ? 'VERIFIED' : 'NOT_STARTED';

  const submitDocument = async (event) => {
    event.preventDefault();
    if (!file) return toast.error('Select a document');
    const body = new FormData();
    body.append('category', category); body.append('documentType', documentType); body.append('consent', String(consent)); body.append('document', file);
    setBusy('document');
    try {
      await verificationAPI.submitDocument(body);
      toast.success('Document sent for review');
      setFile(null); setConsent(false); setFormKeys((keys) => ({ ...keys, document: keys.document + 1 }));
      await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setBusy(''); }
  };

  const submitAuthorization = async (event) => {
    event.preventDefault();
    if (!authLocation || !authFile) return toast.error('Choose a location and document');
    const body = new FormData();
    body.append('documentType', authType); body.append('consent', String(authConsent)); body.append('document', authFile);
    setBusy('authorization');
    try {
      await verificationAPI.submitParkingAuthorization(authLocation, body);
      toast.success('Authorization sent for review');
      setAuthFile(null); setAuthConsent(false); setFormKeys((keys) => ({ ...keys, authorization: keys.authorization + 1 }));
      await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setBusy(''); }
  };

  const runCheck = async (kind, payload) => {
    setBusy('cashfree');
    try {
      await verificationAPI.verifyExternal(kind, payload);
      toast.success(`${kind} verification completed`);
      await load();
      return true;
    } catch (error) { toast.error(error.response?.data?.message || 'Provider verification failed'); return false; }
    finally { setBusy(''); }
  };

  const header = <PageHeader eyebrow="Operator" title="Verification" description="Checks ParkSmart needs before your locations can go live. Documents stay private to reviewers." />;
  if (loading) return <>{header}<ListSkeleton rows={3} /></>;
  if (failed) return <>{header}<ErrorState description="Your verification details didn’t load. Check your connection and try again." onRetry={load} /></>;

  const steps = [
    ...VENDOR_CHECKS.map((check) => ({ ...check, icon: CHECK_ICONS[check.key], status: verification[check.key] })),
    { key: 'authorization', label: 'Location authorisation', copy: 'Ownership, lease, NOC or authorisation proof for each location.', icon: Landmark, status: authorizationStatus },
  ];

  return (
    <>
      {header}

      <section aria-labelledby="overall-title" className="rounded-2xl border bg-card p-5 shadow-hairline sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="overall-title" className="font-display text-lg font-semibold">Overall status</h2>
            <p className="mt-1 text-sm text-text-muted"><span className="font-mono font-semibold text-foreground">{progress}</span> of {VENDOR_CHECKS.length} vendor checks verified</p>
          </div>
          <StatusBadge status={verification.overallStatus} />
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={VENDOR_CHECKS.length} aria-valuenow={progress} aria-label={`${progress} of ${VENDOR_CHECKS.length} checks verified`} className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <span className="block h-full origin-left rounded-full bg-slot-available" style={{ transform: `scaleX(${progress / VENDOR_CHECKS.length})` }} />
        </div>
        <p className="mt-4 text-sm">
          <span className="font-medium">Payouts: </span>
          {verification.payoutEligible ? 'eligible.' : 'not eligible yet. Needs overall and bank verification.'}
        </p>

        <ol aria-label="Verification steps" className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ key, label, copy, icon: Icon, status }, index) => {
            const done = status === 'VERIFIED';
            return (
              <li key={key} className="flex gap-3 rounded-xl bg-surface-sunken p-4">
                <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-lg', done ? 'bg-slot-available-soft text-slot-available' : 'bg-card text-text-muted')}>
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium"><span className="sr-only">Step {index + 1}: </span>{label}</h3>
                  <p className="mt-0.5 text-sm text-text-muted">{copy}</p>
                  <div className="mt-2"><StatusBadge status={status} /></div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel id="upload-title" title="Upload a document" description="Manual review is always available.">
          <form key={formKeys.document} onSubmit={submitDocument} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Check">
                <NativeSelect className="w-full" value={category} onChange={(event) => { const value = event.target.value; setCategory(value); setDocumentType(DOCUMENT_TYPES[value][0]); }}>
                  {Object.keys(DOCUMENT_TYPES).map((value) => <NativeSelectOption key={value} value={value}>{verificationLabel(value)}</NativeSelectOption>)}
                </NativeSelect>
              </FormField>
              <FormField label="Document">
                <NativeSelect className="w-full" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  {DOCUMENT_TYPES[category].map((value) => <NativeSelectOption value={value} key={value}>{verificationLabel(value)}</NativeSelectOption>)}
                </NativeSelect>
              </FormField>
            </div>
            <FilePicker label="File" file={file} onChange={setFile} />
            <ConsentRow checked={consent} onChange={setConsent}>I consent to ParkSmart storing this document privately for vendor verification.</ConsentRow>
            <div>
              <Button type="submit" disabled={busy === 'document' || !consent}>
                {busy === 'document' ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {busy === 'document' ? 'Uploading…' : 'Submit for review'}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel id="providers-title" title="Verify with a provider" description="Faster where available. Provider keys never reach this browser.">
          <div className="grid gap-3">
            {VERIFICATION_PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                available={Boolean(data?.providerAvailability?.[provider.availability])}
                busy={busy === provider.id}
                onCheck={runCheck}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel id="authorization-title" title="Location authorisation" description="Each location needs its own proof that you may run parking there." className="mt-6">
        {locations.length ? (
          <form key={formKeys.authorization} onSubmit={submitAuthorization} className="grid gap-4 lg:grid-cols-2">
            <FormField label="Location">
              <NativeSelect className="w-full" value={authLocation} onChange={(event) => setAuthLocation(event.target.value)}>
                {locations.map((item) => <NativeSelectOption value={item._id} key={item._id}>{item.name}</NativeSelectOption>)}
              </NativeSelect>
            </FormField>
            <FormField label="Evidence">
              <NativeSelect className="w-full" value={authType} onChange={(event) => setAuthType(event.target.value)}>
                {AUTHORIZATION_TYPES.map((value) => <NativeSelectOption value={value} key={value}>{verificationLabel(value)}</NativeSelectOption>)}
              </NativeSelect>
            </FormField>
            <div className="lg:col-span-2"><FilePicker label="File" file={authFile} onChange={setAuthFile} /></div>
            <div className="lg:col-span-2"><ConsentRow checked={authConsent} onChange={setAuthConsent}>I consent to ParkSmart reviewing this authorisation document for this location.</ConsentRow></div>
            <div className="lg:col-span-2">
              <Button type="submit" disabled={busy === 'authorization' || !authConsent}>
                {busy === 'authorization' ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {busy === 'authorization' ? 'Uploading…' : 'Submit authorisation'}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-text-muted">Add a draft location first, then upload its authorisation here. <Link to="/vendor/locations/new" className="font-medium text-brand hover:underline">Add a location</Link></p>
        )}
        <h3 className="mt-6 mb-3 text-sm font-medium">Submitted for locations</h3>
        <EvidenceList
          items={data?.parkingAuthorizations}
          empty="Nothing submitted yet."
          describe={(item) => `${item.parkingLocation?.name || 'Parking location'} · ${verificationLabel(item.documentType)}`}
        />
      </Panel>

      <Panel id="evidence-title" title="Submitted documents" className="mt-6">
        <EvidenceList
          items={data?.documents}
          empty="No documents submitted yet."
          describe={(item) => `${verificationLabel(item.documentType)} · ${verificationLabel(item.provider)} · submitted ${new Date(item.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        />
      </Panel>
    </>
  );
}
