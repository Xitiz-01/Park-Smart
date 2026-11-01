// Container healthcheck: exit 0 when /health/live answers 200, else 1.
// The image's HEALTHCHECK runs it for the API (PORT); the worker sets
// HEALTHCHECK_PORT to its own health port.
const port = process.env.HEALTHCHECK_PORT || process.env.PORT || 5000;

fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(2500) })
  .then((response) => process.exit(response.ok ? 0 : 1))
  .catch(() => process.exit(1));
