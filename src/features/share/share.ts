import { Platform } from 'react-native';

import { shareOrCopy } from './share-utils';

export async function copyText(text: string) {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Copy is available in the web version of Handled.');
  }
  await navigator.clipboard.writeText(text);
}

export async function shareText(title: string, text: string) {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    throw new Error('Sharing is available in the web version of Handled.');
  }
  return shareOrCopy({
    copy: () => copyText(text),
    share:
      typeof navigator.share === 'function' ? () => navigator.share({ text, title }) : undefined,
  });
}

export function downloadIcs(filename: string, contents: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Calendar export is available in the web version of Handled.');
  }
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
