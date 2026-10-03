import { describe, expect, it } from 'vitest';
import { isFeatureUpdate } from '../../src/lib/version';

describe('isFeatureUpdate', () => {
  it.each([
    ['1.4.6', '2.0.0', true],
    ['2.0.0', '2.1.0', true],
    ['2.0.5', '2.1.0', true],
    ['2.0.0', '2.0.1', false],
    ['2.1.0', '2.1.0', false],
    ['2.1.0', '2.0.9', false],
    ['3.0.0', '2.9.0', false],
    ['v1.9.0', '2.0.0', true],
    [undefined, '2.0.0', false],
    ['', '2.0.0', false],
    ['garbage', '2.0.0', false],
  ])('%s -> %s is %s', (previous, current, expected) => {
    expect(isFeatureUpdate(previous, current)).toBe(expected);
  });
});
