export const sampleSubtitles = [
  // 1) Single block, payload TOO LONG for duration
  '00:00:00:00\t00:00:01:00\tThis payload is definitely too long for one second.',
  'This payload is definitely too long for one second.',
  '',

  // 2) Single block, payload OK
  '00:00:01:00\t00:00:03:00\tOK.',
  'OK.',
  '',

  // 3) Two contiguous blocks, SAME payload → should MERGE
  '00:00:03:00\t00:00:04:00\tMerged text',
  'Merged text',
  '',
  '00:00:04:00\t00:00:05:00\tMerged text',
  'Merged text',
  '',

  // 4) Two contiguous blocks, DIFFERENT payload → should NOT merge
  '00:00:05:00\t00:00:06:00\tFirst',
  'First',
  '',
  '00:00:06:00\t00:00:07:00\tSecond',
  'Second',
  '',

  // 5) Two blocks, SAME payload, but GAP in time → should NOT merge
  '00:00:08:00\t00:00:09:00\tGap text',
  'Gap text',
  '',
  '00:00:10:00\t00:00:11:00\tGap text',
  'Gap text',
  '',

  // 6) Two blocks, SAME payload, CONTIGUOUS, NO blank line between
  '00:00:11:00\t00:00:12:00\tNo blank',
  '00:00:12:00\t00:00:13:00\tNo blank',
].join('\n')
