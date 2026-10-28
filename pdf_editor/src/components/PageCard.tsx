import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EditorPage } from '../core/editor/EditorPage';
import type { PdfSource } from '../core/editor/PdfSource';
import { PageThumbnail } from './PageThumbnail';

interface PageCardProps {
  readonly page: EditorPage;
  readonly source: PdfSource;
  readonly pageNumber: number;
  readonly isSelected: boolean;
  readonly onSelect: (page: EditorPage, addToSelection: boolean) => void;
  readonly onOpen: (page: EditorPage) => void;
}

/**
 * One page in the page list: a draggable card showing the page image, its
 * number, and whether it has been edited.
 */
export function PageCard({
  page,
  source,
  pageNumber,
  isSelected,
  onSelect,
  onOpen,
}: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const classNames = [
    'page-card',
    isSelected ? 'page-card--selected' : '',
    isDragging ? 'page-card--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={setNodeRef}
      className={classNames}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-current={isSelected}
    >
      <button
        type="button"
        className="page-card__surface"
        // A plain click selects; ctrl/cmd or shift extends the selection.
        onClick={(event) => onSelect(page, event.ctrlKey || event.metaKey || event.shiftKey)}
        onDoubleClick={() => onOpen(page)}
        aria-label={`Page ${pageNumber} of ${source.fileName}`}
        {...attributes}
        {...listeners}
      >
        <PageThumbnail source={source} page={page} />
      </button>

      <div className="page-card__footer">
        <span className="page-card__number">{pageNumber}</span>
        {page.hasEdits() && (
          <span className="page-card__badge" title="This page has edits">
            edited
          </span>
        )}
      </div>
    </li>
  );
}
