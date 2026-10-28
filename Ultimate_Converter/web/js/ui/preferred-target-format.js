/** Chooses the target a newly queued file is aimed at. */

import {
  ARCHIVE_FORMATS,
  CANVAS_IMAGE_FORMATS,
  CANVAS_IMAGE_SOURCE_ONLY_FORMATS,
  DECODABLE_AUDIO_FORMATS,
  STRUCTURED_DATA_FORMATS,
  TEXT_FORMATS,
} from '../core/format-families.js';

const DEFAULT_TARGETS_BY_FAMILY = [
  [[...CANVAS_IMAGE_FORMATS, ...CANVAS_IMAGE_SOURCE_ONLY_FORMATS], ['png', 'jpg', 'webp']],
  [DECODABLE_AUDIO_FORMATS, ['wav']],
  [STRUCTURED_DATA_FORMATS, ['json', 'csv']],
  [TEXT_FORMATS, ['html', 'txt']],
  [ARCHIVE_FORMATS, ['zip', 'tar.gz']],
];

/**
 * Pick a sensible default so a queued file is ready to convert straight away.
 *
 * The preference is looked up inside the file's own family first, so an image
 * defaults to another image rather than to whatever sorts first.
 */
export function preferredTargetFormat(sourceFormat, availableTargets) {
  for (const [family, preferences] of DEFAULT_TARGETS_BY_FAMILY) {
    if (!family.includes(sourceFormat)) {
      continue;
    }
    const match = preferences.find(
      (preferred) => preferred !== sourceFormat && availableTargets.includes(preferred),
    );
    if (match) {
      return match;
    }
  }
  return availableTargets[0];
}
