import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerMock = {
  kill: ReturnType<typeof vi.fn<() => void>>;
  once: ReturnType<typeof vi.fn<(event: string, handler: () => void) => void>>;
};

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('forks one worker per available processor in production primary mode', async () => {
    process.env['NODE_ENV'] = 'production';
    const workers: WorkerMock[] = [];
    const exitHandlers: Array<() => void> = [];
    const clusterMock = {
      isPrimary: true,
      fork: vi.fn<() => WorkerMock>(() => {
        const worker: WorkerMock = {
          kill: vi.fn<() => void>(),
          once: vi.fn<(event: string, handler: () => void) => void>((_event, handler) => {
            exitHandlers.push(handler);
          }),
        };
        workers.push(worker);
        return worker;
      }),
    };
    const osMock = {
      availableParallelism: vi.fn<() => number>(() => 3),
    };
    const serverImportMock = vi.fn<() => void>();

    vi.doMock('node:cluster', () => ({
      default: clusterMock,
    }));
    vi.doMock('node:os', () => ({
      default: osMock,
    }));
    vi.doMock('./server.mjs', () => {
      serverImportMock();
      return {};
    });

    await import('./main');

    expect(osMock.availableParallelism).toHaveBeenCalled();
    expect(clusterMock.fork).toHaveBeenCalledTimes(3);
    expect(serverImportMock).not.toHaveBeenCalled();
    process.emit('SIGTERM');
    expect(workers.every((worker) => worker.kill.mock.calls.length === 1)).toBe(true);
    for (const handler of exitHandlers) {
      handler();
    }
  }, 10_000);

  it('loads the server in worker mode', async () => {
    process.env['NODE_ENV'] = 'test';
    const clusterMock = {
      isPrimary: false,
      fork: vi.fn<() => WorkerMock>(),
    };
    const osMock = {
      availableParallelism: vi.fn<() => number>(() => 3),
    };
    const serverImportMock = vi.fn<() => void>();

    vi.doMock('node:cluster', () => ({
      default: clusterMock,
    }));
    vi.doMock('node:os', () => ({
      default: osMock,
    }));
    vi.doMock('./server', () => {
      serverImportMock();
      return {};
    });

    await import('./main');

    expect(clusterMock.fork).not.toHaveBeenCalled();
    expect(osMock.availableParallelism).not.toHaveBeenCalled();
    expect(serverImportMock).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('loads one server in a non-production primary process', async () => {
    process.env['NODE_ENV'] = 'test';
    const clusterMock = {
      isPrimary: true,
      fork: vi.fn<() => WorkerMock>(),
    };
    const osMock = {
      availableParallelism: vi.fn<() => number>(() => 3),
    };
    const serverImportMock = vi.fn<() => void>();

    vi.doMock('node:cluster', () => ({
      default: clusterMock,
    }));
    vi.doMock('node:os', () => ({
      default: osMock,
    }));
    vi.doMock('./server', () => {
      serverImportMock();
      return {};
    });

    await import('./main');

    expect(clusterMock.fork).not.toHaveBeenCalled();
    expect(osMock.availableParallelism).not.toHaveBeenCalled();
    expect(serverImportMock).toHaveBeenCalledTimes(1);
  }, 10_000);
});
