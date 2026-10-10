import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClipboardImageError,
  filesFromPasteEvent,
  hasClipboardPasteableImage,
  isClipboardImagePasteAvailable,
  readClipboardImageFile,
} from './clipboardImage';

const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function makePngBlob(): Blob {
  const bytes = new Uint8Array(1100);
  bytes.set(PNG_HEADER, 0);
  return new Blob([bytes], { type: 'image/png' });
}

describe('clipboardImage (mobile)', () => {
  const originalClipboard = globalThis.navigator?.clipboard;
  const originalClipboardItem = globalThis.ClipboardItem;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    class MockClipboardItem {
      types: string[];

      constructor(data: Record<string, Blob>) {
        this.types = Object.keys(data);
        this._data = data;
      }

      private _data: Record<string, Blob>;

      async getType(type: string): Promise<Blob> {
        const blob = this._data[type];
        if (!blob) throw new Error(`Missing type ${type}`);
        return blob;
      }
    }

    globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
  });

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    globalThis.ClipboardItem = originalClipboardItem;
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('isClipboardImagePasteAvailable is false without clipboard.read', () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
    assert.equal(isClipboardImagePasteAvailable(), false);
  });

  it('isClipboardImagePasteAvailable is true when clipboard.read exists', () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { read: async () => [] },
    });
    assert.equal(isClipboardImagePasteAvailable(), true);
  });

  it('readClipboardImageFile returns File from image/png clipboard item', async () => {
    const blob = makePngBlob();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [new globalThis.ClipboardItem!({ 'image/png': blob })],
      },
    });

    const file = await readClipboardImageFile();
    assert.ok(file instanceof File);
    assert.match(file.name, /^pasted-\d+\.png$/);
    assert.equal(file.type, 'image/png');
    assert.ok(file.size > 0);
  });

  it('readClipboardImageFile throws when clipboard has no image', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [new globalThis.ClipboardItem!({ 'text/plain': new Blob(['hello'], { type: 'text/plain' }) })],
      },
    });

    await assert.rejects(
      () => readClipboardImageFile(),
      (err: unknown) => {
        assert.ok(err instanceof ClipboardImageError);
        assert.match((err as Error).message, /Clipboard mein koi image nahi/);
        return true;
      },
    );
  });

  it('hasClipboardPasteableImage is true when image/png is on clipboard', async () => {
    const blob = makePngBlob();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [new globalThis.ClipboardItem!({ 'image/png': blob })],
      },
    });

    assert.equal(await hasClipboardPasteableImage(), true);
  });

  it('hasClipboardPasteableImage is false for plain text only', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [new globalThis.ClipboardItem!({ 'text/plain': new Blob(['hello'], { type: 'text/plain' }) })],
      },
    });

    assert.equal(await hasClipboardPasteableImage(), false);
  });

  it('filesFromPasteEvent returns image files from clipboardData', () => {
    const blob = makePngBlob();
    const file = new File([blob], 'shot.png', { type: 'image/png' });
    const getAsFile = () => file;
    const event = {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile }],
      },
    } as unknown as ClipboardEvent;

    const files = filesFromPasteEvent(event);
    assert.equal(files.length, 1);
    assert.equal(files[0]?.name, 'shot.png');
  });

  it('readClipboardImageFile fetches image when clipboard has image URL text', async () => {
    const blob = makePngBlob();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [
          new globalThis.ClipboardItem!({
            'text/plain': new Blob(['https://example.com/receipt.jpg'], { type: 'text/plain' }),
          }),
        ],
      },
    });

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      blob: async () => blob,
    })) as unknown as typeof fetch;

    const file = await readClipboardImageFile();
    assert.equal(file.type, 'image/png');
    assert.ok(file.size > 0);
  });
});
