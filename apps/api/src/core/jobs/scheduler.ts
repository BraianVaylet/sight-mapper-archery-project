import type { Temporal } from '@js-temporal/polyfill';
import { v7 as uuidv7 } from 'uuid';
import type { Clock } from '../clock/clock.js';
import type { DbConnection } from '../db/connection.js';
import { toDate } from '../db/temporal.js';
import type { Logger } from '../logger/logger.js';

const MONGO_DUPLICATE_KEY = 11000;
export const DEFAULT_TICK_MS = 60_000;

export type JobContext = {
  readonly now: Temporal.Instant;
  readonly connection: DbConnection;
  readonly logger: Logger;
};

/** What a job reports about its run, for `jobRuns.stats`: counts only, never data. */
export type JobStats = Readonly<Record<string, number>>;

export type Job = {
  readonly name: string;
  /** One run per window of this length, across every instance. */
  readonly intervalMs: number;
  /** Must be idempotent: a window can be run again after a crash. */
  run(context: JobContext): Promise<JobStats>;
};

export type JobRun = {
  readonly job: string;
  readonly startedAt: Temporal.Instant;
  readonly finishedAt: Temporal.Instant;
  readonly durationMs: number;
  readonly status: 'ok' | 'failed';
  readonly error?: string;
  readonly stats: JobStats;
};

export type Scheduler = {
  /** One tick: runs every job whose window is open and that this instance wins. */
  runDue(): Promise<JobRun[]>;
  start(): void;
  stop(): void;
};

export type SchedulerDeps = {
  readonly connection: DbConnection;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly jobs: readonly Job[];
  /** Who holds the locks. A new id per process. */
  readonly owner?: string;
  readonly tickMs?: number;
};

type LockDoc = { _id: string; owner: string; lockedUntil: Date };
type RunDoc = {
  job: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  status: 'ok' | 'failed';
  error?: string;
  stats: JobStats;
};

/**
 * In-process scheduler (TECNICO §13). Several instances may run: each job takes a lock in
 * `jobLocks` held until the end of its window, so exactly one instance runs it per window and a
 * job that finishes early is not run again by a slower neighbour. If the owner crashes, the next
 * window runs it again, which is why jobs are idempotent.
 *
 * The lock is one atomic update: it matches only an expired lock, and inserting over a live one
 * hits the `_id` uniqueness, which means "someone else has it".
 */
export function createScheduler(deps: SchedulerDeps): Scheduler {
  const { connection, clock, logger, jobs } = deps;
  const owner = deps.owner ?? uuidv7();
  const tickMs = deps.tickMs ?? DEFAULT_TICK_MS;
  let timer: ReturnType<typeof setInterval> | undefined;

  const db = () => {
    const handle = connection.db;
    if (handle === undefined) throw new Error('scheduler needs a connected database');
    return handle;
  };

  async function acquire(job: Job): Promise<boolean> {
    const now = clock.now();
    try {
      const result = await db()
        .collection<LockDoc>('jobLocks')
        .updateOne(
          { _id: job.name, lockedUntil: { $lte: toDate(now) } },
          {
            $set: {
              owner,
              lockedUntil: toDate(now.add({ milliseconds: job.intervalMs })),
            },
          },
          { upsert: true },
        );
      return result.modifiedCount === 1 || result.upsertedCount === 1;
    } catch (error) {
      if ((error as { code?: number }).code === MONGO_DUPLICATE_KEY) return false;
      throw error;
    }
  }

  async function execute(job: Job): Promise<JobRun> {
    const startedAt = clock.now();
    let status: JobRun['status'] = 'ok';
    let error: string | undefined;
    let stats: JobStats = {};
    try {
      stats = await job.run({
        now: startedAt,
        connection,
        logger: logger.child({ job: job.name }),
      });
    } catch (cause) {
      status = 'failed';
      // The message only: the stack goes to the log, not to a collection people can query.
      error = cause instanceof Error ? cause.message : String(cause);
      logger.error({ err: cause, job: job.name }, 'job failed');
    }
    const finishedAt = clock.now();
    const run: JobRun = {
      job: job.name,
      startedAt,
      finishedAt,
      durationMs: finishedAt.since(startedAt).total('milliseconds'),
      status,
      ...(error === undefined ? {} : { error }),
      stats,
    };
    await db()
      .collection<RunDoc>('jobRuns')
      .insertOne({
        job: run.job,
        startedAt: toDate(run.startedAt),
        finishedAt: toDate(run.finishedAt),
        durationMs: run.durationMs,
        status: run.status,
        ...(run.error === undefined ? {} : { error: run.error }),
        stats: run.stats,
      });
    logger.info({ job: job.name, status, durationMs: run.durationMs, stats }, 'job run');
    return run;
  }

  async function runDue(): Promise<JobRun[]> {
    const runs: JobRun[] = [];
    for (const job of jobs) {
      if (await acquire(job)) runs.push(await execute(job));
    }
    return runs;
  }

  return {
    runDue,
    start() {
      if (timer !== undefined) return;
      timer = setInterval(() => {
        runDue().catch((error: unknown) => logger.error({ err: error }, 'scheduler tick failed'));
      }, tickMs);
      // The scheduler must not keep the process alive on its own.
      timer.unref();
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
  };
}
