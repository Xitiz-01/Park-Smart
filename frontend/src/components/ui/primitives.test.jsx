// Every shadcn primitive must load and export at least one component, so a
// broken import (wrong named/default export, missing dependency) fails CI
// even before a screen uses it.
const modules = import.meta.glob('./*.jsx', { eager: true });

test.each(Object.entries(modules).filter(([path]) => !/\.test\.jsx$/.test(path) && /\/[a-z-]+\.jsx$/.test(path)))(
  '%s exports components',
  (_path, mod) => {
    const exported = Object.values(mod).filter((value) => typeof value === 'function' || typeof value === 'object');
    expect(exported.length).toBeGreaterThan(0);
  },
);
