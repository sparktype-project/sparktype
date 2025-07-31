// src/pages/sites/edit/EditSiteLayout.tsx

import { Outlet } from 'react-router-dom';
import { EditorProvider } from '@/features/editor/contexts/EditorProvider';

/**
 * The root layout for the /edit section.
 *
 * In the Vite + react-router-dom architecture, this layout's primary role
 * is to provide a mounting point for its child routes via the `<Outlet />`
 * component. It wraps all editor pages in the EditorProvider for shared
 * editor state management.
 */
export default function EditSiteLayout() {
  // The <Outlet /> component from react-router-dom will render the
  // matched child route. For example, if the URL is /sites/123/edit/content/about,
  // the EditContentPage component will be rendered here.
  return (
    <EditorProvider>
      <Outlet />
    </EditorProvider>
  );
}