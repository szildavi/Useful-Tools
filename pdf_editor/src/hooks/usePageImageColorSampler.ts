import { useEffect, useState } from 'react';
import { PageImageColorSampler } from '../core/pdf/PageImageColorSampler';

/**
 * Prepares colour sampling for the page currently on screen.
 *
 * The sampler reads the rendered page image, so it is rebuilt whenever that
 * image changes - a different page, a rotation, or a new zoom level.
 */
export function usePageImageColorSampler(
  imageUrl: string | null,
): PageImageColorSampler | null {
  const [sampler, setSampler] = useState<PageImageColorSampler | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSampler(null);
      return;
    }
    let isSuperseded = false;
    PageImageColorSampler.forImage(imageUrl).then((result) => {
      if (!isSuperseded) {
        setSampler(result);
      }
    });
    return () => {
      isSuperseded = true;
    };
  }, [imageUrl]);

  return sampler;
}
