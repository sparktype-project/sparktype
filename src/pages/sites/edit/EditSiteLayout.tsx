// src/pages/sites/edit/EditSiteLayout.tsx

import { Outlet } from 'react-router-dom';

/**
 * The root layout for the /edit section.
 *
 * In the Vite + react-router-dom architecture, this layout's primary role
 * is to provide a mounting point for its child routes via the `<Outlet />`
 * component. It can also be used to wrap all editor pages in a common
 * context or layout if needed in the future.
 */
export default function EditSiteLayout() {
  // The <Outlet /> component from react-router-dom will render the
  // matched child route. For example, if the URL is /sites/123/edit/content/about,
  // the EditContentPage component will be rendered here.
  return <Outlet />;
}