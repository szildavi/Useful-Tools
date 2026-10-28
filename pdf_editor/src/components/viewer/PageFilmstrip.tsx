import { useEffect, useRef } from 'react';
import type { EditorSession } from '../../state/useEditorSession';
import { PageThumbnail } from '../PageThumbnail';

interface PageFilmstripProps {
  readonly session: EditorSession;
}

/** A vertical strip of pages for moving between them while editing. */
export function PageFilmstrip({ session }: PageFilmstripProps) {
  const { document: editorDocument, activePage } = session;
  const activeItemRef = useRef<HTMLLIElement>(null);

  // Keep the page being edited visible when it changes from the keyboard.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activePage?.id]);

  return (
    <nav className="filmstrip" aria-label="Pages">
      <ul className="filmstrip__list">
        {editorDocument.pages.map((page, index) => {
          const isActive = page.id === activePage?.id;
          return (
            <li key={page.id} ref={isActive ? activeItemRef : undefined}>
              <button
                type="button"
                className={`filmstrip__item ${isActive ? 'filmstrip__item--active' : ''}`}
                onClick={() => session.openPage(page.id)}
                aria-current={isActive}
              >
                <span className="filmstrip__thumbnail">
                  <PageThumbnail source={editorDocument.sourceOf(page)} page={page} />
                </span>
                <span className="filmstrip__number">{index + 1}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
