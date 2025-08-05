// src/features/editor/adapters/SparktypeBlockAdapter.tsx

import React, { useState, useEffect } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { defaultProps } from '@blocknote/core';
import type { Block, InlineContent } from '@blocknote/core';
import { BlockDiscoveryService, type DiscoveredBlock, type SparktypeBlockDefinition } from '@/core/services/blockDiscovery.service';
import { useSparktypeContext } from '../contexts/SparktypeBlockContext';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import type { LocalSiteData } from '@/core/types';

/**
 * Props that will be available to all Sparktype blocks in BlockNote
 */
export interface SparktypeBlockProps {
  block: Block;
  content: Record<string, any>;
  config: Record<string, any>;
  sparktypeData: {
    siteData: any;
    collections: any[];
    currentPage: any;
  };
}

/**
 * Generic Sparktype block component that renders using discovered block templates
 */
function SparktypeBlockComponent({ 
  props, 
  sparktypeBlockId 
}: { 
  props: any;
  sparktypeBlockId: string;
}) {
  const [discoveredBlock, setDiscoveredBlock] = useState<DiscoveredBlock | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const sparktypeData = useSparktypeContext();
  
  // Show form if block has no content yet or if explicitly requested
  const hasConfig = props.block.props?.sparktypeData?.config && Object.keys(props.block.props.sparktypeData.config).length > 0;
  const hasContentData = props.block.props?.sparktypeData?.content && Object.keys(props.block.props.sparktypeData.content).length > 0;
  const hasContent = hasConfig || hasContentData;
  const shouldShowForm = showForm || !hasContent;

  useEffect(() => {
    const loadBlock = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Discover the block using site data if available
        const discoveredBlock = await BlockDiscoveryService.getBlockById(sparktypeBlockId, sparktypeData.siteData || undefined);
        if (!discoveredBlock) {
          throw new Error(`Block not found: ${sparktypeBlockId}`);
        }
        
        setDiscoveredBlock(discoveredBlock);
        
        // Load the template if available
        const templateContent = await BlockDiscoveryService.loadBlockTemplate(discoveredBlock);
        setTemplate(templateContent);
        
      } catch (err) {
        console.error(`Failed to load Sparktype block ${sparktypeBlockId}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadBlock();
  }, [sparktypeBlockId, sparktypeData.siteData]);

  if (loading) {
    return (
      <div className="sparktype-block-loading">
        <div className="loading-spinner">Loading {sparktypeBlockId}...</div>
      </div>
    );
  }

  if (error || !discoveredBlock) {
    return (
      <div className="sparktype-block-error">
        <div className="error-message">
          Failed to load block: {error || 'Block not found'}
        </div>
      </div>
    );
  }

  // Handle form data changes
  const handleFormChange = (formData: object) => {
    // Update the block's sparktypeData with form data
    if (props.editor && props.editor.updateBlock) {
      props.editor.updateBlock(props.block, {
        props: {
          ...props.block.props,
          sparktypeData: formData,
        },
      });
    }
  };

  return (
    <div className="sparktype-block" data-block-id={sparktypeBlockId}>
      <div className="sparktype-block-header">
        <strong>{discoveredBlock.definition.name}</strong>
        <span className="sparktype-block-id">({sparktypeBlockId})</span>
        {discoveredBlock.definition.isCore && <span className="sparktype-block-badge">Core</span>}
        {!shouldShowForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded"
          >
            Edit
          </button>
        )}
      </div>
      
      {shouldShowForm && (discoveredBlock.manifest?.configSchema || discoveredBlock.manifest?.contentSchema) && (
        <div className="sparktype-block-form border p-4 rounded">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Configure {discoveredBlock.definition.name}</h3>
            {hasContent && (
              <button 
                onClick={() => setShowForm(false)}
                className="text-xs bg-gray-500 text-white px-2 py-1 rounded"
              >
                Done
              </button>
            )}
          </div>
          {/* Show config form if configSchema exists */}
          {discoveredBlock.manifest.configSchema && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Block Configuration</h4>
              <SchemaDrivenForm
                schema={discoveredBlock.manifest.configSchema}
                uiSchema={discoveredBlock.manifest.configUiSchema || {}}
                formData={props.block.props?.sparktypeData?.config || {}}
                onFormChange={(data) => handleFormChange({ 
                  ...props.block.props?.sparktypeData, 
                  config: data 
                })}
                liveValidate={false}
                formContext={{
                  siteData: sparktypeData.siteData,
                  currentPage: sparktypeData.currentPage,
                  collections: sparktypeData.collections,
                }}
              />
            </div>
          )}
          
          {/* Show content form if contentSchema exists */}
          {discoveredBlock.manifest.contentSchema && (
            <div>
              <h4 className="text-sm font-medium mb-2">Block Content</h4>
              <SchemaDrivenForm
                schema={discoveredBlock.manifest.contentSchema}
                uiSchema={discoveredBlock.manifest.contentUiSchema || {}}
                formData={props.block.props?.sparktypeData?.content || {}}
                onFormChange={(data) => handleFormChange({ 
                  ...props.block.props?.sparktypeData, 
                  content: data 
                })}
                liveValidate={false}
                formContext={{
                  siteData: sparktypeData.siteData,
                  currentPage: sparktypeData.currentPage,
                  collections: sparktypeData.collections,
                }}
              />
            </div>
          )}
        </div>
      )}
      
      {!shouldShowForm && hasContent && (
        <div className="sparktype-block-preview border p-4 rounded bg-gray-50">
          {hasConfig && (
            <div className="mb-3">
              <div className="text-sm text-gray-600 font-medium">Configuration:</div>
              <pre className="text-xs mt-1 overflow-auto max-h-20 bg-white p-2 rounded border">
                {JSON.stringify(props.block.props?.sparktypeData?.config || {}, null, 2)}
              </pre>
            </div>
          )}
          {hasContentData && (
            <div>
              <div className="text-sm text-gray-600 font-medium">Content:</div>
              <pre className="text-xs mt-1 overflow-auto max-h-20 bg-white p-2 rounded border">
                {JSON.stringify(props.block.props?.sparktypeData?.content || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {!discoveredBlock.manifest?.configSchema && !discoveredBlock.manifest?.contentSchema && (
        <div className="sparktype-block-content">
          <div className="text-yellow-600 p-4 border border-yellow-300 rounded bg-yellow-50">
            <strong>No schema found for this block.</strong>
            <p className="text-sm mt-1">This block needs a manifest with a schema to be configurable.</p>
          </div>
          <div className="sparktype-block-data mt-4">
            <strong>Block Properties:</strong>
            <pre>{JSON.stringify(props.block.props || {}, null, 2)}</pre>
          </div>
          {template && (
            <div className="sparktype-block-template">
              <strong>Template Preview:</strong>
              <pre className="template-preview">{template.substring(0, 200)}...</pre>
            </div>
          )}
        </div>
      )}
      
      {/* Editable content area */}
      <div className="inline-content" ref={props.contentRef} />
    </div>
  );
}

/**
 * Creates a BlockNote block spec for a Sparktype block
 */
export function createSparktypeBlockSpec(definition: SparktypeBlockDefinition) {
  const blockType = definition.id.replace(':', '_'); // Convert core:image -> core_image
  
  console.log(`Creating block spec for ${blockType} with definition:`, definition);
  
  try {
    const spec = createReactBlockSpec(
      {
        type: blockType,
        propSchema: {
          // Include standard BlockNote props for text alignment, colors, etc.
          textAlignment: defaultProps.textAlignment,
          textColor: defaultProps.textColor,
          backgroundColor: defaultProps.backgroundColor,
          // Custom Sparktype properties
          sparktypeData: {
            default: {},
          },
        },
        content: "inline" as const, // Allow inline content editing
      },
      {
        render: (props) => (
          <SparktypeBlockComponent 
            props={props}
            sparktypeBlockId={definition.id}
          />
        ),
      }
    );
    
    console.log(`Successfully created spec for ${blockType}:`, spec);
    return spec;
  } catch (error) {
    console.error(`Failed to create spec for ${blockType}:`, error);
    throw error;
  }
}

/**
 * Adapter service for converting Sparktype blocks to BlockNote blocks
 */
export class SparktypeBlockAdapter {
  private static blockSpecs: Map<string, any> = new Map();

  /**
   * Discovers all available Sparktype blocks and creates BlockNote specs for them
   */
  static async discoverAndCreateSpecs(siteData?: LocalSiteData): Promise<Record<string, any>> {
    const discoveredBlocks = await BlockDiscoveryService.discoverBlocks(siteData);
    const specs: Record<string, any> = {};

    for (const discoveredBlock of discoveredBlocks) {
      const blockType = discoveredBlock.definition.id.replace(':', '_');
      const spec = createSparktypeBlockSpec(discoveredBlock.definition);
      
      specs[blockType] = spec;
      this.blockSpecs.set(blockType, spec);
      
      console.log(`Created BlockNote spec for: ${discoveredBlock.definition.id} -> ${blockType}`, spec);
    }

    return specs;
  }

  /**
   * Gets a specific block spec by Sparktype block ID
   */
  static getBlockSpec(sparktypeBlockId: string): any | null {
    const blockType = sparktypeBlockId.replace(':', '_');
    return this.blockSpecs.get(blockType) || null;
  }

  /**
   * Gets all available block specs
   */
  static getAllBlockSpecs(): Record<string, any> {
    const specs: Record<string, any> = {};
    for (const [blockType, spec] of this.blockSpecs.entries()) {
      specs[blockType] = spec;
    }
    return specs;
  }

  /**
   * Converts a Sparktype block directive to BlockNote block data
   */
  static sparktypeToBlockNote(blockId: string, content: any, config: any): Block {
    const blockType = blockId.replace(':', '_');
    
    return {
      id: crypto.randomUUID(),
      type: blockType,
      props: {
        content: content || {},
        config: config || {},
      },
      content: [],
      children: [],
    } as Block;
  }

  /**
   * Converts a BlockNote block back to Sparktype format
   */
  static blockNoteToSparktype(block: Block): { blockId: string; content: any; config: any } {
    const blockId = block.type.replace('_', ':');
    
    return {
      blockId,
      content: block.props?.content || {},
      config: block.props?.config || {},
    };
  }
}