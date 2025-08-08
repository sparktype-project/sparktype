'use client';

import React from 'react';



import type { TImageElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import type { ImageRef } from '@/core/types';

import { useDraggable } from '@platejs/dnd';
import { ImagePlugin, useMediaState } from '@platejs/media/react';
import { ResizableProvider, useResizableValue } from '@platejs/resizable';
import { PlateElement, withHOC } from 'platejs/react';

import { cn } from '@/lib/utils';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useAppStore } from '@/core/state/useAppStore';

import { Caption, CaptionTextarea } from './caption';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';

interface SparkTypeImageElement extends TImageElement {
  imageRef?: ImageRef;
  siteId?: string;
}

export const SparkTypeImageElement = withHOC(
  ResizableProvider,
  function SparkTypeImageElement(props: PlateElementProps<SparkTypeImageElement>) {
    const { align = 'center', focused, readOnly, selected } = useMediaState();
    const width = useResizableValue('width');

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    const { imageRef } = props.element;

    // Try to get siteId from element or derive it from the editor
    const elementSiteId = props.element.siteId;
    
    // If no ImageRef metadata but we have an asset path, try to reconstruct ImageRef
    let effectiveImageRef = imageRef;
    if (!imageRef && props.element.url.startsWith('assets/images/')) {
      // For existing images loaded from markdown, create a minimal ImageRef
      effectiveImageRef = {
        serviceId: 'local' as const,
        src: props.element.url,
        alt: props.element.alt as string || '',
        width: props.element.initialWidth || 0,
        height: props.element.initialHeight || 0,
      };
      console.log('Reconstructed ImageRef for existing image:', effectiveImageRef);
    }

    // Generate proper display URLs using ImageRef
    const [displayUrl, setDisplayUrl] = React.useState<string>(props.element.url);
    
    React.useEffect(() => {
      const generateDisplayUrl = async () => {
        if (!effectiveImageRef) {
          console.log('No effective ImageRef, using element URL:', props.element.url);
          setDisplayUrl(props.element.url);
          return;
        }

        try {
          // Get siteId - try element first, then derive from URL context
          let siteId = elementSiteId;
          if (!siteId) {
            // Try to get siteId from the current page context
            const currentPath = window.location.pathname;
            const siteIdMatch = currentPath.match(/\/sites\/([^\/]+)/);
            siteId = siteIdMatch?.[1];
          }
          
          if (!siteId) {
            console.log('No siteId available, using element URL');
            setDisplayUrl(props.element.url);
            return;
          }

          const site = useAppStore.getState().getSiteById(siteId);
          if (!site) {
            console.log('Site not found, using element URL');
            setDisplayUrl(props.element.url);
            return;
          }

          const imageService = getActiveImageService(site.manifest);
          
          // Generate display URL for browser preview (blob URL for live preview)
          const url = await imageService.getDisplayUrl(
            site.manifest,
            effectiveImageRef,
            { 
              width: typeof width === 'string' ? parseInt(width, 10) : (width || effectiveImageRef.width), 
              height: effectiveImageRef.height 
            },
            false // isExport = false generates blob URLs for browser display
          );
          
          console.log('Generated display URL:', url);
          console.log('URL type:', url.startsWith('blob:') ? 'blob URL' : 'other');
          setDisplayUrl(url);
        } catch (error) {
          console.error('Failed to generate display URL:', error);
          setDisplayUrl(props.element.url);
        }
      };

      generateDisplayUrl();
    }, [effectiveImageRef, elementSiteId, width]);

    return (
      <MediaToolbar plugin={ImagePlugin}>
        <PlateElement {...props} className="py-2.5">
          <figure className="group relative m-0" contentEditable={false}>
            <Resizable
              align={align}
              options={{
                align,
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />
              <img
                ref={handleRef}
                src={displayUrl}
                className={cn(
                  'block w-full max-w-full cursor-pointer object-cover px-0',
                  'rounded-sm',
                  focused && selected && 'ring-2 ring-ring ring-offset-2',
                  isDragging && 'opacity-50'
                )}
                alt={props.element.alt as string | undefined}
                style={{ width: width || 'auto' }}
                onDoubleClick={() => {
                  // Handle image preview similar to standard PlateJS
                  console.log('Image double-clicked');
                }}
              />
              <ResizeHandle
                className={mediaResizeHandleVariants({
                  direction: 'right',
                })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption style={{ width }} align={align}>
              <CaptionTextarea
                readOnly={readOnly}
                onFocus={(e) => {
                  e.preventDefault();
                }}
                placeholder="Write a caption..."
              />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  }
);