import type { EditorPage } from '../core/editor/EditorPage';
import type { PdfSource } from '../core/editor/PdfSource';
import { useRenderedPage } from '../hooks/useRenderedPage';

/**
 * The area a thumbnail is rendered into, in CSS pixels. Its shape matches the
 * card in `PageGrid.css`, so a page fills as much of the card as its own
 * proportions allow.
 */
const THUMBNAIL_AREA = { widthInPixels: 260, heightInPixels: 368 };

interface PageThumbnailProps {
  readonly source: PdfSource;
  readonly page: EditorPage;
}

/** The rendered image of one page, sized to fit the page card whole. */
export function PageThumbnail({ source, page }: PageThumbnailProps) {
  const { rendered, isRendering, errorMessage } = useRenderedPage(
    source,
    page,
    THUMBNAIL_AREA.widthInPixels,
    THUMBNAIL_AREA.heightInPixels,
  );

  if (errorMessage) {
    return (
      <div className="thumbnail__placeholder thumbnail__placeholder--error">{errorMessage}</div>
    );
  }

  if (!rendered) {
    return <div className="thumbnail__placeholder">Rendering…</div>;
  }

  return (
    <img
      className="thumbnail__image"
      src={rendered.imageUrl}
      alt=""
      draggable={false}
      style={{ opacity: isRendering ? 0.6 : 1 }}
    />
  );
}
