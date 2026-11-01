// Conventional Commits, checked locally by the commit-msg hook and in CI.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subjects often start with a product or provider name ("Cashfree bank
    // account check", "EV bays page"), which the default rule rejects.
    'subject-case': [0],
  },
};
