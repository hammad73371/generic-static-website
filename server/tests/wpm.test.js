import test from 'node:test';
import assert from 'node:assert/strict';
import { wpmFromCounts, cpmFromCounts } from '../utils.js';

test('wpmFromCounts calculates correctly', () => {
  // 250 chars in 60s = 50 words = 50 WPM
  assert.equal(wpmFromCounts(250, 60_000), 50);
  // zero time edge -> avoid Infinity
  assert.ok(Number.isFinite(wpmFromCounts(0, 0)));
});

test('cpmFromCounts calculates correctly', () => {
  assert.equal(cpmFromCounts(300, 60_000), 300);
  assert.ok(Number.isFinite(cpmFromCounts(0, 0)));
});