/**
 * Build an idempotent shutdown: stop accepting connections, let in-flight
 * requests finish, close Socket.IO, then close each dependency in order.
 * If that takes longer than timeoutMs the process exits with code 1.
 *
 * @param {{
 *   server: import('http').Server,
 *   io?: { close: (callback?: () => void) => unknown },
 *   closers?: { name: string, close: () => Promise<unknown> }[],
 *   logger: import('pino').Logger,
 *   timeoutMs?: number,
 *   exit?: (code: number) => void,
 * }} options
 * @returns {(reason: string, exitCode?: number) => Promise<void>}
 */
function createShutdown({ server, io, closers = [], logger, timeoutMs = 10000, exit = (code) => process.exit(code) }) {
  let shuttingDown;
  return (reason, exitCode = 0) => {
    if (shuttingDown) return shuttingDown;
    logger.info({ reason }, 'shutting down');
    const force = setTimeout(() => {
      logger.error({ reason, timeoutMs }, 'shutdown timed out, forcing exit');
      exit(1);
    }, timeoutMs);
    force.unref?.();

    shuttingDown = (async () => {
      let code = exitCode;
      try {
        if (server.listening) {
          const closed = new Promise((resolve) => server.close(resolve));
          server.closeIdleConnections?.();
          await closed;
        }
        if (io) await new Promise((resolve) => io.close(() => resolve()));
        for (const { name, close } of closers) {
          try {
            await close();
          } catch (error) {
            code = 1;
            logger.error({ err: error, dependency: name }, 'failed to close cleanly');
          }
        }
        logger.info({ reason, exitCode: code }, 'shutdown complete');
      } finally {
        clearTimeout(force);
        exit(code);
      }
    })();
    return shuttingDown;
  };
}

/**
 * SIGTERM and SIGINT shut down cleanly (exit 0). An unhandled rejection or
 * uncaught exception is logged and treated as fatal: the process drains and
 * exits 1 rather than carrying on in an unknown state, so the host restarts it.
 *
 * @param {{ shutdown: (reason: string, exitCode?: number) => Promise<void>, logger: import('pino').Logger, target?: NodeJS.EventEmitter }} options
 */
function installProcessHandlers({ shutdown, logger, target = process }) {
  ['SIGTERM', 'SIGINT'].forEach((signal) => target.on(signal, () => shutdown(signal, 0)));
  target.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
    shutdown('unhandledRejection', 1);
  });
  target.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    shutdown('uncaughtException', 1);
  });
}

module.exports = { createShutdown, installProcessHandlers };
