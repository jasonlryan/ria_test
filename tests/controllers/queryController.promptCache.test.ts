import { describe, it, expect, vi } from 'vitest';


describe('renderAssistantPrompt caching', () => {
  it('uses cached template after initial load', async () => {
    const readFileMock = vi.fn().mockResolvedValue('Prompt {{{USER_QUESTION}}}');
    vi.doMock('fs/promises', () => ({ default: { readFile: readFileMock } }));

    const module = await import('../../app/api/controllers/queryController');
    const { renderAssistantPrompt } = module;

    // readFile called once during module initialization
    expect(readFileMock).toHaveBeenCalledTimes(1);

    await renderAssistantPrompt('q1', {});
    await renderAssistantPrompt('q2', {});
    // Should not read file again
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('reloads template if cache is empty', async () => {
    vi.resetModules();
    const readFileMock = vi
      .fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('Filled');
    vi.doMock('fs/promises', () => ({ default: { readFile: readFileMock } }));

    const module = await import('../../app/api/controllers/queryController');
    const { renderAssistantPrompt } = module;

    expect(readFileMock).toHaveBeenCalledTimes(1);
    await renderAssistantPrompt('q', {});
    // Second call due to fallback reload
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });
});
