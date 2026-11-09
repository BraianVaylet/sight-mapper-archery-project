import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * A one-node replica set, like Atlas: transactions need it. The version is pinned to the mongod
 * already in the local cache, so nothing is downloaded on a developer machine.
 */
export async function startReplSet(): Promise<MongoMemoryReplSet> {
  return MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: process.env['MONGOMS_VERSION'] ?? '7.0.24' },
  });
}
