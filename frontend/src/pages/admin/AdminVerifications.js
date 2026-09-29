import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/ui/StatusBadge';
import { adminAPI } from '../../services/api';

const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function AdminVerifications() {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ status: '', vendor: '', type: '' });
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCases = useCallback(async () => {
    try { const { data } = await adminAPI.getVerificationCases({ status: filters.status || undefined, vendor: filters.vendor || undefined, type: filters.type || undefined }); setCases(data.cases || []); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load verification cases'); }
  }, [filters.status, filters.vendor, filters.type]);

  const loadDetail = useCallback(async (vendorId) => {
    if (!vendorId) return;
    try { const { data } = await adminAPI.getVerificationCase(vendorId); setDetail(data); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load this case'); }
  }, []);

  useEffect(() => { const timer = setTimeout(loadCases, 250); return () => clearTimeout(timer); }, [loadCases]);
  useEffect(() => { loadDetail(selected?.vendor?._id); }, [selected, loadDetail]);

  const evidence = useMemo(() => {
    const items = [
      ...(detail?.documents || []).map((item) => ({ ...item, evidenceType: 'document', context: item.category })),
      ...(detail?.parkingAuthorizations || []).map((item) => ({ ...item, evidenceType: 'authorization', context: item.parkingLocation?.name || 'Parking location' })),
    ];
    return filters.type ? items.filter((item) => item.evidenceType === filters.type) : items;
  }, [detail, filters.type]);

  const act = async (event) => {
    event.preventDefault();
    if (!review) return;
    if (review.action !== 'approve' && !reason.trim()) return toast.error('Enter a review reason');
    setBusy(true);
    try {
      await adminAPI.reviewVerificationEvidence(review.item.evidenceType, review.item._id, review.action, reason);
      toast.success('Review decision saved'); setReview(null); setReason(''); await Promise.all([loadCases(), loadDetail(selected.vendor._id)]);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save decision'); }
    finally { setBusy(false); }
  };

  const download = async (item) => {
    try {
      const { data } = await adminAPI.getVerificationDocument(item.evidenceType, item._id);
      const url = URL.createObjectURL(data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'verification-document'; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to access private document'); }
  };

  return <main className="fade-in verification-page">
    <header className="page-header"><div><span className="page-eyebrow">Trust operations</span><h1>Verification Review</h1><p>Review vendor and location evidence with a complete decision trail.</p></div></header>
    <section className="card verification-filters" aria-label="Verification filters">
      <label><Search size={15} aria-hidden="true" /> Vendor<input className="form-input" value={filters.vendor} onChange={(event) => setFilters({ ...filters, vendor: event.target.value })} placeholder="Name or email" /></label>
      <label>Status<select className="form-input" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{['NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Evidence<select className="form-input" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option value="document">Vendor document</option><option value="authorization">Parking authorization</option></select></label>
    </section>

    <div className="admin-verification-layout">
      <section className="card verification-case-list" aria-label="Verification cases">
        <h2>Cases</h2>
        {cases.length ? cases.map((item) => <button className={`verification-case ${selected?._id === item._id ? 'active' : ''}`} key={item._id} onClick={() => setSelected(item)}>
          <span><strong>{item.vendor?.businessName || item.vendor?.userId?.name || 'Vendor'}</strong><small>{item.vendor?.userId?.email || item.vendor?.businessEmail}</small></span><StatusBadge status={item.overallStatus} />
        </button>) : <div className="empty-state"><ShieldCheck size={34} /><p>No matching cases.</p></div>}
      </section>

      <section className="card verification-case-detail" aria-live="polite">
        {!selected ? <div className="empty-state"><ShieldCheck size={42} /><h2>Select a verification case</h2><p>Evidence and audit activity will appear here.</p></div> : <>
          <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}><div><p className="page-eyebrow">Vendor</p><h2>{selected.vendor?.businessName || selected.vendor?.userId?.name}</h2></div><StatusBadge status={detail?.verification?.overallStatus || selected.overallStatus} /></div>
          <div className="verification-summary-row">{['identityStatus', 'businessStatus', 'bankStatus'].map((key) => <div key={key}><span>{label(key.replace('Status', ''))}</span><StatusBadge status={detail?.verification?.[key]} /></div>)}</div>
          <h3>Evidence</h3>
          <div className="verification-evidence-list">{evidence.length ? evidence.map((item) => <article key={`${item.evidenceType}-${item._id}`}>
            <div><strong>{label(item.documentType)}</strong><p>{label(item.context)} · {label(item.provider || 'MANUAL')}</p>{item.safeMetadata && <small>{Object.entries(item.safeMetadata).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${label(key)}: ${value}`).join(' · ')}</small>}{(item.rejectionReason || item.resubmissionReason) && <small>{item.rejectionReason || item.resubmissionReason}</small>}</div>
            <StatusBadge status={item.status} />
            {item.safeMetadata?.mimeType && <button className="btn btn-sm btn-outline" onClick={() => download(item)}><Download size={14} /> Private file</button>}
            <div className="review-actions"><button className="btn btn-sm btn-primary" onClick={() => setReview({ item, action: 'approve' })}>Approve</button><button className="btn btn-sm btn-outline" onClick={() => setReview({ item, action: 'resubmit' })}>Resubmit</button><button className="btn btn-sm btn-danger" onClick={() => setReview({ item, action: 'reject' })}>Reject</button></div>
          </article>) : <p>No matching evidence.</p>}</div>
          <h3>Audit history</h3>
          <ol className="verification-audit">{detail?.audit?.map((item) => <li key={item._id}><span>{label(item.action)}</span><small>{new Date(item.createdAt).toLocaleString()} · {item.previousStatus ? `${label(item.previousStatus)} → ` : ''}{label(item.newStatus)}{item.note ? ` · ${item.note}` : ''}</small></li>)}</ol>
        </>}
      </section>
    </div>

    {review && <div className="modal-backdrop" role="presentation"><form className="modal-panel card review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onSubmit={act}>
      <h2 id="review-title">{label(review.action)} {label(review.item.documentType)}</h2>
      {review.action === 'approve' ? <p>Confirm that this evidence meets ParkSmart's verification requirements.</p> : <label>Reason<textarea className="form-input" rows="4" value={reason} onChange={(event) => setReason(event.target.value)} required autoFocus /></label>}
      <div className="review-actions"><button type="button" className="btn btn-outline" onClick={() => { setReview(null); setReason(''); }}>Cancel</button><button className="btn btn-primary" disabled={busy}>Save decision</button></div>
    </form></div>}
  </main>;
}
