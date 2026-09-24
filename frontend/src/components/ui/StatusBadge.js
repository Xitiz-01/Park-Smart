import React from 'react';

const tones = {
  approved: 'success', active: 'success', available: 'success', paid: 'success',
  pending: 'warning', upcoming: 'info', reserved: 'warning', maintenance: 'warning',
  rejected: 'danger', suspended: 'danger', cancelled: 'danger', occupied: 'danger', inactive: 'neutral',
  completed: 'coral', refunded: 'coral',
};

export default function StatusBadge({ status, children }) {
  const value = String(status || 'unknown').toLowerCase();
  return <span className={`status-badge status-${tones[value] || 'info'}`}><i />{children || value.replace('_', ' ')}</span>;
}
