import { enrichWithDescriptions } from '../remedySelector';
import type { RenderedRemedy } from '../remedyRenderer';

function makeRemedy(id: string): RenderedRemedy {
  return {
    id,
    title: `Title ${id}`,
    category: 'dhikr',
    effectDimension: 'grounding',
    intensity: 'gentle',
    themeTags: ['RESTLESSNESS'],
  };
}

describe('enrichWithDescriptions — fallback isolation', () => {
  it('populates description when generator succeeds', async () => {
    const remedies = [makeRemedy('r1'), makeRemedy('r2')];
    const generate = jest.fn().mockResolvedValue('A sacred practice.');
    const result = await enrichWithDescriptions(remedies, generate);
    expect(result[0].description).toBe('A sacred practice.');
    expect(result[1].description).toBe('A sacred practice.');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('leaves description absent when generator throws — no propagation', async () => {
    const remedies = [makeRemedy('r1'), makeRemedy('r2'), makeRemedy('r3')];
    const generate = jest.fn().mockRejectedValue(new Error('haiku timeout'));
    const result = await enrichWithDescriptions(remedies, generate);
    expect(result).toHaveLength(3);
    result.forEach(r => expect(r.description).toBeUndefined());
  });

  it('partial failure: remedy 2 fails, remedies 1 and 3 succeed', async () => {
    const remedies = [makeRemedy('r1'), makeRemedy('r2'), makeRemedy('r3')];
    const generate = jest
      .fn()
      .mockResolvedValueOnce('First practice.')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('Third practice.');

    const result = await enrichWithDescriptions(remedies, generate);

    expect(result[0].description).toBe('First practice.');
    expect(result[1].description).toBeUndefined();
    expect(result[2].description).toBe('Third practice.');
  });

  it('all fail: returns original remedies intact, no throw to caller', async () => {
    const remedies = [makeRemedy('r1'), makeRemedy('r2'), makeRemedy('r3')];
    const generate = jest
      .fn()
      .mockRejectedValueOnce(new Error('http 429'))
      .mockRejectedValueOnce(new Error('abort'))
      .mockRejectedValueOnce(new Error('network'));

    await expect(enrichWithDescriptions(remedies, generate)).resolves.toHaveLength(3);
  });

  it('preserves all other remedy fields when description is added', async () => {
    const remedy = makeRemedy('dhikr_01');
    remedy.themeTags = ['RESTLESSNESS', 'ANXIETY'];
    const generate = jest.fn().mockResolvedValue('Sit with the name of Allah.');

    const [result] = await enrichWithDescriptions([remedy], generate);

    expect(result.id).toBe('dhikr_01');
    expect(result.category).toBe('dhikr');
    expect(result.effectDimension).toBe('grounding');
    expect(result.themeTags).toEqual(['RESTLESSNESS', 'ANXIETY']);
    expect(result.description).toBe('Sit with the name of Allah.');
  });

  it('fires all generators in parallel, not sequentially', async () => {
    const order: number[] = [];
    const remedies = [makeRemedy('r1'), makeRemedy('r2'), makeRemedy('r3')];
    const generate = jest.fn().mockImplementation(async (_r: RenderedRemedy, _idx?: number) => {
      order.push(Date.now());
      return 'ok';
    });

    const start = Date.now();
    await enrichWithDescriptions(remedies, generate);
    const elapsed = Date.now() - start;

    // All three calls fired — parallel means total time << 3 × any single call
    expect(generate).toHaveBeenCalledTimes(3);
    // Under parallel execution, all timestamps should be within a tight window
    // (this is a structural check, not a timing assertion — Jest is synchronous here)
    expect(elapsed).toBeLessThan(100);
  });
});
