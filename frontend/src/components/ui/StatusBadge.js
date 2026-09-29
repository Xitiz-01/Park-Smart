import React from 'react';

const tones = {
  approved: 'success', active: 'success', available: 'success', paid: 'success', verified: 'success',
  pending: 'warning', under_review: 'warning', upcoming: 'info', reserved: 'warning', maintenance: 'warning', draft: 'neutral', not_started: 'neutral',
  rejected: 'danger', resubmission_required: 'danger', suspended: 'danger', cancelled: 'danger', occupied: 'danger', inactive: 'neutral',
  completed: 'coral', refunded: 'coral',
};

export default function StatusBadge({ status, children }) {
  const value = String(status || 'unknown').toLowerCase();
  return <span className={`status-badge status-${tones[value] || 'info'}`}><i aria-hidden="true" />{children || value.replaceAll('_', ' ')}</span>;
}
