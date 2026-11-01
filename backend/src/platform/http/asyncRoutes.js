/**
 * Express 4 doesn't catch rejected promises from async handlers: the error
 * escapes as an unhandled rejection instead of reaching the error
 * middleware. This walks a router (and any routers mounted inside it) and
 * forwards rejections to next().
 *
 * Error middleware (four parameters) is left alone, because Express tells
 * it apart by arity.
 *
 * @template {import('express').Router} R
 * @param {R} router
 * @returns {R}
 */
function forwardAsyncErrors(router) {
  const wrapLayer = (layer) => {
    const handle = layer.handle;
    if (handle.stack) {
      handle.stack.forEach(visit);
      return;
    }
    if (handle.length === 4 || handle.forwardsAsyncErrors) return;
    const wrapped = function forwardRejection(req, res, next) {
      const result = handle.call(this, req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
      return result;
    };
    wrapped.forwardsAsyncErrors = true;
    layer.handle = wrapped;
  };
  const visit = (layer) => {
    if (layer.route) layer.route.stack.forEach(wrapLayer);
    else wrapLayer(layer);
  };
  router.stack.forEach(visit);
  return router;
}

module.exports = { forwardAsyncErrors };
