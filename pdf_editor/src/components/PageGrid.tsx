import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { EditorDocument } from '../core/editor/EditorDocument';
import type { EditorPage } from '../core/editor/EditorPage';
import type { PageId } from '../core/editor/Identifiers';
import { PageCard } from './PageCard';
import './PageGrid.css';

interface PageGridProps {
  readonly document: EditorDocument;
  readonly isSelected: (pageId: PageId) => boolean;
  readonly onSelect: (page: EditorPage, addToSelection: boolean) => void;
  readonly onOpen: (page: EditorPage) => void;
  readonly onMovePage: (pageId: PageId, targetIndex: number) => void;
}

/**
 * Shows every page of the document as a grid of draggable cards, which is how
 * the user reorders, selects and opens pages.
 */
export function PageGrid({
  document,
  isSelected,
  onSelect,
  onOpen,
  onMovePage,
}: PageGridProps) {
  // A small activation distance keeps a click from being read as a tiny drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pageIds = document.pages.map((page) => page.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const targetIndex = pageIds.indexOf(over.id as PageId);
    onMovePage(active.id as PageId, targetIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pageIds} strategy={rectSortingStrategy}>
        <ul className="page-grid">
          {document.pages.map((page, index) => (
            <PageCard
              key={page.id}
              page={page}
              source={document.sourceOf(page)}
              pageNumber={index + 1}
              isSelected={isSelected(page.id)}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
