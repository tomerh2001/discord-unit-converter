import { describe, expect, it } from 'vitest';
import { analyze, convertMessageContent, renderReply } from '../src/conversion/index.js';

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

describe('convertMessageContent (idempotent re-conversion)', () => {
  it('does not double-convert an already-converted message', () => {
    const once = convertMessageContent('I ran 10 km today').reply;
    expect(once).toBe('I ran 10 km (**6.21 mi**) today');
    // Converting the converted message reproduces it exactly — no nesting.
    expect(convertMessageContent(once).reply).toBe(once);
  });

  it('cleanly re-renders a partially-converted message', () => {
    const partial = 'It is 30°C (**86°F**) and I drove 5 miles';
    expect(convertMessageContent(partial).reply).toBe(
      'It is 30°C (**86°F**) and I drove 5 miles (**8.05 km**)',
    );
  });

  it('leaves non-quantity bold/parenthetical text alone', () => {
    expect(convertMessageContent('I walked 5 km (**so far!**)').reply).toBe(
      'I walked 5 km (**3.11 mi**) (**so far!**)',
    );
  });
});
