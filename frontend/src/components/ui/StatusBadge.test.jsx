import { renderToStaticMarkup } from 'react-dom/server';
import StatusBadge from './StatusBadge';

test.each([
  ['NOT_STARTED', 'not started'],
  ['UNDER_REVIEW', 'under review'],
  ['VERIFIED', 'verified'],
  ['RESUBMISSION_REQUIRED', 'resubmission required'],
])('renders %s as a readable text status', (status, text) => {
  const markup = renderToStaticMarkup(<StatusBadge status={status} />);
  expect(markup).toContain(text);
});
