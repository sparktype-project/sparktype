// src/features/editor/components/widgets/index.ts

import type { ComponentType } from 'react';
import type { WidgetProps } from '@rjsf/utils';

// Widget imports
import ImageUploadWidget from './ImageUploadWidget';
import DataSourceSelectWidget from './DataSourceSelectWidget';
import SwitchWidget from './SwitchWidget';
import RichTextWidget from './RichTextWidget';
import PartialSelectorWidget from './PartialSelectorWidget';

/**
 * Registry of all available editor widgets for RJSF forms.
 * These widgets are used in block content and config schemas.
 */
export const editorWidgets: Record<string, ComponentType<WidgetProps>> = {
  // Existing widgets (moved from other locations)
  imageUploader: ImageUploadWidget,
  dataSourceSelect: DataSourceSelectWidget,
  switch: SwitchWidget,
  
  // New block-specific widgets
  richText: RichTextWidget,
  partialSelector: PartialSelectorWidget,
};

/**
 * Helper function to get a widget by name with type safety
 */
export function getWidget(widgetName: string): ComponentType<WidgetProps> | undefined {
  return editorWidgets[widgetName];
}

/**
 * Get all available widget names
 */
export function getAvailableWidgets(): string[] {
  return Object.keys(editorWidgets);
}

// Re-export individual widgets for direct imports
export { default as ImageUploadWidget } from './ImageUploadWidget';
export { default as DataSourceSelectWidget } from './DataSourceSelectWidget';
export { default as SwitchWidget } from './SwitchWidget';
export { default as RichTextWidget } from './RichTextWidget';
export { default as PartialSelectorWidget } from './PartialSelectorWidget';