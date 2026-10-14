// Prescription limits, contact rules and IST date helpers.
import { describe, it, expect } from 'vitest';

import { rxProblems, normalizeRx, normalizeMobile, isMobile, isPin, isEmail } from '../../shared/rules.js';
import { todayIST, addDays, isDate } from '../../server/lib/ist.js';

const eye = (o) => Object.assign({ sph: '-1.25', cyl: '', axis: '', add: '' }, o);
const rx = (r, l, pd = '63') => ({ r: eye(r), l: eye(l), pd });

describe('prescription limits', () => {
  it('accepts a normal prescription', () => {
    expect(rxProblems(rx({}, {}), false)).toEqual([]);
  });
  it('SPH runs from -20.00 to +12.00 in 0.25 steps', () => {
    expect(rxProblems(rx({ sph: '-20' }, { sph: '12' }), false)).toEqual([]);
    expect(rxProblems(rx({ sph: '-20.25' }, {}), false)[0].path).toBe('r.sph');
    expect(rxProblems(rx({}, { sph: '12.25' }), false)[0].path).toBe('l.sph');
    expect(rxProblems(rx({ sph: '1.1' }, {}), false)[0].message).toMatch(/0\.25 steps/);
    expect(rxProblems(rx({ sph: '' }, {}), false)[0].message).toMatch(/enter SPH/);
  });
  it('CYL runs from -6.00 to 0.00 in 0.25 steps', () => {
    expect(rxProblems(rx({ cyl: '-6', axis: '90' }, {}), false)).toEqual([]);
    expect(rxProblems(rx({ cyl: '-6.25', axis: '90' }, {}), false)[0].path).toBe('r.cyl');
    expect(rxProblems(rx({ cyl: '0.5', axis: '90' }, {}), false)[0].path).toBe('r.cyl');
  });
  it('AXIS is a whole number from 1 to 180, required when CYL is not 0', () => {
    expect(rxProblems(rx({ cyl: '-1' }, {}), false)[0].path).toBe('r.axis');
    expect(rxProblems(rx({ cyl: '-1', axis: '181' }, {}), false)[0].path).toBe('r.axis');
    expect(rxProblems(rx({ cyl: '-1', axis: '90.5' }, {}), false)[0].path).toBe('r.axis');
    expect(rxProblems(rx({ cyl: '-1', axis: '180' }, {}), false)).toEqual([]);
  });
  it('ADD runs from +0.75 to +3.50 and is required for bifocal and progressive', () => {
    expect(rxProblems(rx({}, {}), true).map((p) => p.path)).toEqual(['r.add', 'l.add']);
    expect(rxProblems(rx({ add: '0.75' }, { add: '3.5' }), true)).toEqual([]);
    expect(rxProblems(rx({ add: '3.75' }, { add: '2' }), true)[0].path).toBe('r.add');
  });
  it('PD runs from 50 to 76 mm', () => {
    expect(rxProblems(rx({}, {}, '49'), false)[0].path).toBe('pd');
    expect(rxProblems(rx({}, {}, '76'), false)).toEqual([]);
  });
  it('normalises form strings to numbers', () => {
    expect(normalizeRx(rx({ cyl: '-0.5', axis: '10' }, {}), false)).toEqual({
      r: { sph: -1.25, cyl: -0.5, axis: 10 },
      l: { sph: -1.25, cyl: 0, axis: null },
      pd: 63,
    });
  });
});

describe('contact rules', () => {
  it('normalises and checks Indian mobile numbers', () => {
    expect(normalizeMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeMobile('09876543210')).toBe('9876543210');
    expect(isMobile('9876543210')).toBe(true);
    expect(isMobile('5876543210')).toBe(false);
    expect(isMobile('987654321')).toBe(false);
  });
  it('checks PIN codes and email', () => {
    expect(isPin('560001')).toBe(true);
    expect(isPin('060001')).toBe(false);
    expect(isEmail('a@b.in')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
});

describe('IST dates', () => {
  it('uses IST, not UTC, for today', () => {
    // 20:00 UTC on 14 Oct is 01:30 IST on 15 Oct.
    expect(todayIST(Date.parse('2026-10-14T20:00:00Z'))).toBe('2026-10-15');
    expect(todayIST(Date.parse('2026-10-14T18:00:00Z'))).toBe('2026-10-14');
  });
  it('adds days across month ends and checks real dates', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-02-28')).toBe(true);
  });
});
