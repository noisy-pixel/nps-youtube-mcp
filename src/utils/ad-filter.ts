import type { Chapter, TranscriptSegment } from "../types/youtube.js";

const AD_PATTERNS: RegExp[] = [
  /\bsponsor\b/i,
  /\bsponsored\b/i,
  /\bsponsored by\b/i,
  /\bsponsor segment\b/i,
  /\bsponsor read\b/i,
  /\bsponsored segment\b/i,
  /\bad\b/i,
  /\badvertisement\b/i,
  /\bad break\b/i,
  /\bad read\b/i,
  /\bpromo\b/i,
  /\bpromotion\b/i,
  /\bpromoted\b/i,
  /\bpaid promotion\b/i,
  /\bbrought to you by\b/i,
  /\bword from our sponsor\b/i,
  /\btoday'?s sponsor\b/i,
  /\bpartner\b/i,
  /\bpartnership\b/i,
];

function isAdChapter(title: string): boolean {
  return AD_PATTERNS.some((pattern) => pattern.test(title));
}

export function filterAdSegments(
  segments: TranscriptSegment[],
  chapters: Chapter[]
): { filtered: TranscriptSegment[]; removedChapters: string[] } {
  const adChapters = chapters.filter((ch) => isAdChapter(ch.title));

  if (adChapters.length === 0) {
    return { filtered: segments, removedChapters: [] };
  }

  const filtered = segments.filter((segment) => {
    return !adChapters.some(
      (ch) => segment.start >= ch.startTime && segment.start < ch.endTime
    );
  });

  return {
    filtered,
    removedChapters: adChapters.map((ch) => ch.title),
  };
}
