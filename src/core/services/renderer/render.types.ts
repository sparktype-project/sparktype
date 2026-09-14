// src/core/services/renderer/render.types.ts

/**
 * Shared types for the renderer pipeline.
 *
 * This module is a dependency leaf: it imports nothing else from the renderer, so both the
 * orchestrator and its extracted stages (and the services that feed them, such as
 * context.service and navigationStructure.service) can use these types without creating an
 * import cycle.
 */

/**
 * Defines the options passed to the main render function.
 */
export interface RenderOptions {
    siteRootPath: string;
    isExport: boolean;
    relativeAssetPath?: string;
    forIframe?: boolean;
}

/** Attributes carried by a `::collection_view` directive node (parsed by remark-directive). */
export interface CollectionDirectiveAttributes {
    collection?: string;
    layout?: string;
    displayType?: string;
    maxItems?: string;
    sortBy?: string;
    sortOrder?: string;
    tagFilters?: string;
    [key: string]: unknown;
}

/** Minimal shape of an mdast node produced by remark-directive. */
export interface MdastDirectiveNode {
    type: string;
    name?: string;
    attributes?: CollectionDirectiveAttributes;
    children?: unknown[];
    value?: string;
}

export interface MdxJsxAttribute {
    type: 'mdxJsxAttribute';
    name: string;
    value: string | null;
}

export interface MdxJsxFlowElementNode {
    type: 'mdxJsxFlowElement';
    name?: string;
    attributes?: MdxJsxAttribute[];
    children?: MdxJsxFlowElementNode[];
}

export interface MdxJsxElementLike {
    name?: string;
    attributes?: MdxJsxAttribute[];
}

/** Minimal shape of an mdast image node. */
export interface MdastImageNode {
    type: 'image';
    url: string;
    alt?: string | null;
}

/** Minimal shape of a hast element node produced by remark-rehype. */
export interface HastElementNode {
    type: 'element';
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastElementNode[];
}

export interface HastRootNode {
    type: 'root';
}
