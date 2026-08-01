import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimEmailDelivery,
  completeEmailDelivery,
  releaseEmailDelivery,
} from '../worker/database.js';

function fakeDatabase(changes) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return { run: async () => ({ meta: { changes } }) };
        },
      };
    },
  };
}

test('email claims return an invocation-specific lease ID', async () => {
  const ORDERS = fakeDatabase(1);
  const leaseId = await claimEmailDelivery({ ORDERS }, 'cs_test_example', 1_000_000);

  assert.match(leaseId, /^[0-9a-f-]{36}$/u);
  assert.match(ORDERS.calls[0].sql, /delivery_lease_id = \?/u);
  assert.equal(ORDERS.calls[0].values[1], leaseId);
});

test('stale email workers cannot complete or release another lease', async () => {
  const lostCompletion = fakeDatabase(0);
  await assert.rejects(
    () => completeEmailDelivery(
      { ORDERS: lostCompletion },
      'cs_test_example',
      'stale-lease',
      'message-id',
      1_000_000,
    ),
    /lease was lost/u,
  );
  assert.match(lostCompletion.calls[0].sql, /delivery_lease_id = \?/u);

  const lostRelease = fakeDatabase(0);
  assert.equal(await releaseEmailDelivery(
    { ORDERS: lostRelease },
    'cs_test_example',
    'stale-lease',
    'email_error',
    1_000_000,
  ), false);
  assert.match(lostRelease.calls[0].sql, /delivery_lease_id = \?/u);
});
