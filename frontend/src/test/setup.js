import '@testing-library/jest-dom/vitest';

// Browser APIs jsdom doesn't provide but Motion, Radix and the Lot Map use.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  });
}
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
