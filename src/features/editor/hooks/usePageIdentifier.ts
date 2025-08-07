// src/features/editor/hooks/usePageIdentifier.ts

import { useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import { type ParsedMarkdownFile, type StructureNode, type LocalSiteData } from '@/core/types';
import { getCollectionContext, type CollectionContext } from '@/core/services/collectionContext.service';

interface PageIdentifierParams {
  siteStructure: StructureNode[];
  allContentFiles: ParsedMarkdownFile[];
  siteData: LocalSiteData | null;
}

/**
 * A data-aware hook that parses the URL to identify the site and the specific
 * file path being targeted for editing, using react-router-dom hooks.
 */
export function usePageIdentifier({ allContentFiles, siteData }: PageIdentifierParams) {
  // Get routing information from react-router-dom
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation();

  // The full path after the hash, e.g., /sites/123/edit/content/about
  const fullPath = location.pathname;

  const { slugSegments, isNewFileMode } = useMemo(() => {
    // Defines the base path for the content editor
    const editorRootPath = `/sites/${siteId}/edit/content`;
    
    if (fullPath.startsWith(editorRootPath)) {
      const slugPart = fullPath.substring(editorRootPath.length).replace(/^\//, '');
      const segments = slugPart ? slugPart.split('/') : [];
      const isNew = segments.includes(NEW_FILE_SLUG_MARKER);
      return { slugSegments: segments, isNewFileMode: isNew };
    }
    
    // Default case if not in a content editor route
    return { slugSegments: [], isNewFileMode: false };
  }, [fullPath, siteId]);

  const filePath = useMemo(() => {
    if (isNewFileMode) {
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }

    const slug = slugSegments.join('/');
    if (slug) {
      return `content/${slug}.md`;
    }
    
    // Homepage Resolution Logic: Find the file with homepage: true
    const homepageFile = allContentFiles.find(f => f.frontmatter.homepage === true);
    if (homepageFile) {
      return homepageFile.path;
    }
    
    return ''; // Return empty string if no path can be determined
  }, [slugSegments, isNewFileMode, allContentFiles]);

  // Compute collection context based on the file path
  const collectionContext = useMemo((): CollectionContext => {
    return getCollectionContext(filePath, siteData, isNewFileMode);
  }, [filePath, siteData, isNewFileMode]);

  return { 
    siteId, 
    isNewFileMode, 
    filePath,
    collectionContext
  };
}