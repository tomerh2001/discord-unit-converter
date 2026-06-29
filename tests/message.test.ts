import { describe, expect, it } from 'vitest';
import { analyze, renderReply } from '../src/conversion/index.js';

describe('analyze + renderReply (the auto-detection path)', () => {
  it('renders the original text with bolded conversions inline', () => {
    const text = "It's 10 km to the store";
    const reply = renderReply(text, analyze(text));
    expect(reply).toBe("It's 10 km (**6.21 mi**) to the store");
  });

  it('converts several units in one message', () => {
    const text = 'Bring 2 kg of flour, oven at 200°C, drive 5 miles';
    const reply = renderReply(text, analyze(text));
    expect(reply).toContain('2 kg (**');
    expect(reply).toContain('200°C (**392°F**)');
    expect(reply).toContain('5 miles (**8.05 km**)');
  });

  it('returns no annotations when there is nothing to convert', () => {
    expect(analyze('just a normal sentence')).toEqual([]);
  });
});
