import React from 'react';

export default function LoadingState({ cards = 3 }) {
  return <div className="skeleton-grid" aria-label="Loading">{Array.from({ length: cards }, (_, index) => <div className="skeleton-card" key={index}><i /><span /><span /></div>)}</div>;
}
