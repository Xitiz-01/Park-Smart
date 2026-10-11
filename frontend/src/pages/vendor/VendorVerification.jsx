import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck2, Landmark, ShieldCheck, Upload, WalletCards } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/ui/StatusBadge';
import { verificationAPI, vendorsAPI } from '../../services/api';

const steps = [
  { key: 'identityStatus', label: 'Identity', icon: ShieldCheck, copy: 'PAN, driving licence, or another supported identity proof.' },
  { key: 'businessStatus', label: 'Business', icon: FileCheck2, copy: 'GSTIN, CIN, or business registration evidence.' },
  { key: 'bankStatus', label: 'Bank readiness', icon: WalletCards, copy: 'Bank proof or a cancelled cheque for future payouts.' },
];

const typesByCategory = {
  IDENTITY: ['PAN', 'DRIVING_LICENCE', 'OTHER_IDENTITY'],
  BUSINESS: ['GSTIN', 'CIN', 'BUSINESS_REGISTRATION'],
  BANK: ['BANK_PROOF', 'CANCELLED_CHEQUE'],
};

const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function VendorVerification() {
  const [data, setData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('IDENTITY');
  const [documentType, setDocumentType] = useState('PAN');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [authLocation, setAuthLocation] = useState('');
  const [authType, setAuthType] = useState('OWNERSHIP_PROOF');
  const [authFile, setAuthFile] = useState(null);
  const [authConsent, setAuthConsent] = useState(false);
  const [digiConsent, setDigiConsent] = useState(false);
  const [providerForm, setProviderForm] = useState({ kind: 'PAN', identifier: '', name: '', consent: false });
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const [verification, parking] = await Promise.all([verificationAPI.getMine(), vendorsAPI.getLocations()]);
      setData(verification.data);
      setLocations(parking.data.locations || []);
      setAuthLocation((value) => value || parking.data.locations?.[0]?._id || '');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load verification'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (searchParams.get('digilocker') === 'success') toast.success('DigiLocker documents received');
  }, [searchParams]);

  const progress = useMemo(() => data ? steps.filter((step) => data.verification?.[step.key] === 'VERIFIED').length : 0, [data]);

  const submitDocument = async (event) => {
    event.preventDefault();
    if (!file) return toast.error('Select a document');
    const body = new FormData();
    body.append('category', category); body.append('documentType', documentType); body.append('consent', String(consent)); body.append('document', file);
    setBusy(true);
    try { await verificationAPI.submitDocument(body); toast.success('Document sent for review'); setFile(null); setConsent(false); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };

  const submitAuthorization = async (event) => {
    event.preventDefault();
    if (!authLocation || !authFile) return toast.error('Choose a location and document');
    const body = new FormData();
    body.append('documentType', authType); body.append('consent', String(authConsent)); body.append('document', authFile);
    setBusy(true);
    try { await verificationAPI.submitParkingAuthorization(authLocation, body); toast.success('Authorization sent for review'); setAuthFile(null); setAuthConsent(false); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };

  const startDigiLocker = async () => {
    setBusy(true);
    try { const { data: result } = await verificationAPI.startDigiLocker(digiConsent); window.location.assign(result.authorizationUrl); }
    catch (error) { toast.error(error.response?.data?.message || 'DigiLocker is unavailable'); setBusy(false); }
  };

  const runExternal = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await verificationAPI.verifyExternal(providerForm.kind, { identifier: providerForm.identifier, name: providerForm.name, businessName: providerForm.name, consent: providerForm.consent });
      toast.success(`${providerForm.kind} verification completed`); setProviderForm((value) => ({ ...value, identifier: '', consent: false })); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Provider verification failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  const verification = data?.verification || {};
  return <main className="fade-in verification-page">
    <header className="page-header"><div><span className="page-eyebrow">Trust onboarding</span><h1>Vendor Verification</h1><p>Complete business checks before publishing new parking locations.</p></div></header>

    <section className="card verification-hero" aria-labelledby="overall-status">
      <div><p className="page-eyebrow">Overall status</p><h2 id="overall-status"><StatusBadge status={verification.overallStatus} /></h2><p>{progress} of 3 vendor checks verified</p></div>
      <div className="verification-progress" role="progressbar" aria-valuemin="0" aria-valuemax="3" aria-valuenow={progress} aria-label={`${progress} of 3 checks verified`}><span style={{ width: `${(progress / 3) * 100}%` }} /></div>
      <p><strong>Payout readiness:</strong> {verification.payoutEligible ? 'Eligible' : 'Not eligible yet'} — requires overall and bank verification.</p>
    </section>

    <section className="verification-step-grid" aria-label="Verification progress">
      {steps.map(({ key, label: title, icon: Icon, copy }) => <article className="card verification-step" key={key}><Icon size={22} aria-hidden="true" /><div><h2>{title}</h2><p>{copy}</p><StatusBadge status={verification[key]} /></div></article>)}
      <article className="card verification-step"><Landmark size={22} aria-hidden="true" /><div><h2>Parking authorization</h2><p>Each location needs its own ownership, lease, NOC, or authorization proof.</p><StatusBadge status={data?.parkingAuthorizations?.some((item) => item.status === 'VERIFIED') ? 'VERIFIED' : 'NOT_STARTED'} /></div></article>
    </section>

    <div className="verification-columns">
      <section className="card"><h2>Manual document upload</h2><p className="section-copy">Manual review is always available. PDF, JPEG, or PNG; maximum 5 MB.</p>
        <form onSubmit={submitDocument} className="verification-form">
          <label>Verification area<select className="form-input" value={category} onChange={(event) => { const value = event.target.value; setCategory(value); setDocumentType(typesByCategory[value][0]); }}>{Object.keys(typesByCategory).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Document type<select className="form-input" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{typesByCategory[category].map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
          <label>Private document<input className="form-input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files[0])} /></label>
          <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I consent to ParkSmart storing this document privately for vendor verification.</label>
          <button className="btn btn-primary" disabled={busy || !consent}><Upload size={16} /> Submit for review</button>
        </form>
      </section>

      <section className="card"><h2>Verified provider options</h2><p className="section-copy">Only configured providers are actionable. Provider secrets never reach this browser.</p>
        <div className="provider-option"><div><strong>DigiLocker Requester</strong><p>{data?.providerAvailability?.digilocker ? 'Available for consent-based verified document retrieval.' : 'Unavailable — requester credentials are pending setup.'}</p></div><label className="consent-row"><input type="checkbox" checked={digiConsent} onChange={(event) => setDigiConsent(event.target.checked)} disabled={!data?.providerAvailability?.digilocker} /> I consent to ParkSmart requesting only permitted identity and business document metadata from DigiLocker for vendor verification.</label><button className="btn btn-outline" disabled={busy || !data?.providerAvailability?.digilocker || !digiConsent} onClick={startDigiLocker}>Verify with DigiLocker</button></div>
        {data?.providerAvailability?.cashfree ? <form onSubmit={runExternal} className="verification-form provider-option">
          <strong>Cashfree Secure ID</strong>
          <label>Check<select className="form-input" value={providerForm.kind} onChange={(event) => setProviderForm({ ...providerForm, kind: event.target.value })}><option>PAN</option><option>GSTIN</option></select></label>
          <label>Identifier<input className="form-input" autoComplete="off" value={providerForm.identifier} onChange={(event) => setProviderForm({ ...providerForm, identifier: event.target.value })} required /></label>
          <label>Name / business name<input className="form-input" value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} required /></label>
          <label className="consent-row"><input type="checkbox" checked={providerForm.consent} onChange={(event) => setProviderForm({ ...providerForm, consent: event.target.checked })} /> I consent to this verification request.</label>
          <button className="btn btn-outline" disabled={busy || !providerForm.consent}>Run verification</button>
        </form> : <div className="provider-option"><strong>Cashfree Secure ID</strong><p>Unavailable — credentials are not configured. PAN and GSTIN checks will appear here when enabled.</p></div>}
      </section>
    </div>

    <section className="card"><h2>Parking location authorization</h2><p className="section-copy">Submit separate authority evidence for the location you want to publish.</p>
      {locations.length ? <form onSubmit={submitAuthorization} className="verification-form verification-form-inline">
        <label>Location<select className="form-input" value={authLocation} onChange={(event) => setAuthLocation(event.target.value)}>{locations.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
        <label>Evidence type<select className="form-input" value={authType} onChange={(event) => setAuthType(event.target.value)}>{['OWNERSHIP_PROOF', 'LEASE', 'NOC', 'AUTHORIZATION_LETTER', 'OTHER'].map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
        <label>Private document<input className="form-input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setAuthFile(event.target.files[0])} /></label>
        <label className="consent-row"><input type="checkbox" checked={authConsent} onChange={(event) => setAuthConsent(event.target.checked)} /> I consent to authorization review.</label>
        <button className="btn btn-primary" disabled={busy || !authConsent}>Submit authorization</button>
      </form> : <p>Create a draft parking location first.</p>}
      <div className="verification-list">{data?.parkingAuthorizations?.map((item) => <div key={item._id}><span>{item.parkingLocation?.name || 'Parking location'} · {label(item.documentType)}{(item.rejectionReason || item.resubmissionReason) && <small className="verification-reason">Action needed: {item.rejectionReason || item.resubmissionReason}</small>}</span><StatusBadge status={item.status} /></div>)}</div>
    </section>

    <section className="card"><h2>Submitted evidence</h2><div className="verification-list">{data?.documents?.length ? data.documents.map((item) => <div key={item._id}><span><strong>{label(item.documentType)}</strong> · {label(item.provider)} · submitted {new Date(item.submittedAt).toLocaleDateString()}{(item.rejectionReason || item.resubmissionReason) && <small className="verification-reason">Action needed: {item.rejectionReason || item.resubmissionReason}</small>}</span><StatusBadge status={item.status} /></div>) : <p>No documents submitted yet.</p>}</div></section>
  </main>;
}
