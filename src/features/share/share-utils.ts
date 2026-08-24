export async function shareOrCopy({
  copy,
  share,
}: {
  copy: () => Promise<void>;
  share?: () => Promise<void>;
}) {
  if (share) {
    await share();
    return 'shared' as const;
  }
  await copy();
  return 'copied' as const;
}
