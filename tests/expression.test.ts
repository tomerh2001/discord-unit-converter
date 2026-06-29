import { describe, expect, it } from 'vitest';
import { convertExpression } from '../src/conversion/index.js';

describe('convertExpression (the /convert path)', () => {
  it('converts to an explicit target', () => {
    expect(convertExpression('10 km to miles').lines).toEqual(['10 km = **6.21 mi**']);
    expect(convertExpression('100c to f').lines).toEqual(['100°C = **212°F**']);
    expect(convertExpression('1 gallon in liters').lines).toEqual(['1 gal = **3.79 L**']);
  });

  it('auto-converts when no target is given', () => {
    expect(convertExpression('72f').lines).toEqual(['72°F = **22.22°C**']);
  });

  it('handles several quantities at once', () => {
    const { lines } = convertExpression('5 kg and 10 cm');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('5 kg = **');
    expect(lines[1]).toContain('10 cm = **');
  });

  it('reports incompatible explicit conversions', () => {
    const { lines } = convertExpression('10 km to kg');
    expect(lines[0]).toContain('incompatible');
  });

  it('errors on input with no units', () => {
    expect(convertExpression('hello there').error).toBeTruthy();
  });

  it('falls back to auto when the target unit is unknown', () => {
    expect(convertExpression('10 km to bananas').lines).toEqual(['10 km = **6.21 mi**']);
  });
});
