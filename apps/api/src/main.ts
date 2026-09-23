/** Starts the clustered HikingDownward API process and loads the server worker. */
import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary && process.env['NODE_ENV'] === 'production') {
  const workers = new Set<ReturnType<typeof cluster.fork>>();

  for (let i = 0; i < os.availableParallelism(); i += 1) {
    const worker = cluster.fork();
    workers.add(worker);
    worker.once('exit', () => workers.delete(worker));
  }

  process.once('SIGTERM', () => {
    for (const worker of workers) {
      worker.kill('SIGTERM');
    }
  });
} else {
  /* v8 ignore next: the built server always uses the generated .mjs module. */
  const serverModulePath = import.meta.url.endsWith('.mjs') ? './server.mjs' : './server';
  await import(serverModulePath);
}
