// Small helpers used by the interface: prices and HTML escaping.
import { describe, expect, it } from 'vitest';
import { money, esc } from '../../src/lib/dom.js';

describe('money', () => {
  it('formats rupees with Indian digit grouping', () => {
    expect(money(1490)).toBe('₹1,490');
    expect(money(125000)).toBe('₹1,25,000');
    expect(money(0)).toBe('₹0');
  });
  it('rounds to whole rupees', () => {
    expect(money(1489.6)).toBe('₹1,490');
  });
});

describe('esc', () => {
  it('escapes text before it goes into HTML', () => {
    expect(esc('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(esc(42)).toBe('42');
  });
});
