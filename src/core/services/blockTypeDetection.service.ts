// src/core/services/blockTypeDetection.service.ts

import { type BlockRegistry } from './blockRegistry.service';

export interface BlockDetectionResult {
  blockId: string;
  confidence: number;
  triggerMatch: string;
  cleanText: string;
}

export class BlockTypeDetectionService {
  private registry: BlockRegistry;

  constructor(registry: BlockRegistry) {
    this.registry = registry;
  }

  /**
   * Detect block type from input text with confidence scoring
   */
  detectBlockType(text: string): BlockDetectionResult | null {
    if (!text.trim()) return null;

    const detectableBlocks = this.registry.getDetectableBlocks();
    const results: BlockDetectionResult[] = [];

    for (const [blockId, manifest] of Object.entries(detectableBlocks)) {
      const patterns = manifest.behavior?.patterns;
      if (!patterns) continue;

      // Check trigger pattern
      if (patterns.trigger) {
        const triggerResult = this.checkTriggerPattern(text, patterns.trigger, blockId);
        if (triggerResult) {
          results.push(triggerResult);
        }
      }

      // Check regex pattern
      if (patterns.regex) {
        const regexResult = this.checkRegexPattern(text, patterns.regex, blockId);
        if (regexResult) {
          results.push(regexResult);
        }
      }
    }

    // Return the result with highest confidence
    return results.length > 0 
      ? results.sort((a, b) => b.confidence - a.confidence)[0]
      : null;
  }

  /**
   * Check if text matches a trigger pattern
   */
  private checkTriggerPattern(text: string, trigger: string, blockId: string): BlockDetectionResult | null {
    // Exact match with space
    if (text === trigger) {
      return {
        blockId,
        confidence: 1.0,
        triggerMatch: trigger,
        cleanText: ''
      };
    }

    // Starts with trigger and has space
    if (text.startsWith(trigger) && text.length > trigger.length) {
      const remaining = text.substring(trigger.length);
      return {
        blockId,
        confidence: 0.9,
        triggerMatch: trigger,
        cleanText: remaining.trim()
      };
    }

    return null;
  }

  /**
   * Check if text matches a regex pattern
   */
  private checkRegexPattern(text: string, pattern: string, blockId: string): BlockDetectionResult | null {
    try {
      const regex = new RegExp(pattern);
      const match = text.match(regex);
      
      if (match) {
        const triggerMatch = match[0];
        const cleanText = text.replace(regex, '').trim();
        
        return {
          blockId,
          confidence: 0.8,
          triggerMatch,
          cleanText
        };
      }
    } catch (error) {
      console.warn(`Invalid regex pattern for block ${blockId}:`, pattern);
    }

    return null;
  }

  /**
   * Get all possible completions for partial input
   */
  getCompletions(partialText: string): Array<{
    blockId: string;
    trigger: string;
    completion: string;
    name: string;
  }> {
    if (!partialText.trim()) return [];

    const detectableBlocks = this.registry.getDetectableBlocks();
    const completions: Array<{
      blockId: string;
      trigger: string;
      completion: string;
      name: string;
    }> = [];

    for (const [blockId, manifest] of Object.entries(detectableBlocks)) {
      const trigger = manifest.behavior?.patterns?.trigger;
      
      if (trigger && trigger.startsWith(partialText)) {
        completions.push({
          blockId,
          trigger,
          completion: trigger.substring(partialText.length),
          name: manifest.name
        });
      }
    }

    return completions.sort((a, b) => a.trigger.length - b.trigger.length);
  }

  /**
   * Check if text should trigger auto-formatting
   */
  shouldAutoFormat(text: string, blockId: string): boolean {
    const manifest = this.registry.getBlockManifest(blockId);
    if (!manifest?.behavior?.patterns?.autoFormat) return false;

    const detection = this.detectBlockType(text);
    return detection !== null && detection.blockId !== blockId;
  }

  /**
   * Get smart suggestions based on context
   */
  getSmartSuggestions(currentText: string, previousBlocks: string[]): Array<{
    blockId: string;
    name: string;
    reason: string;
  }> {
    const suggestions: Array<{
      blockId: string;
      name: string;
      reason: string;
    }> = [];

    // Analyze current text for patterns
    if (currentText.toLowerCase().includes('image') || currentText.toLowerCase().includes('photo')) {
      suggestions.push({
        blockId: 'core:image',
        name: 'Image',
        reason: 'Detected image-related content'
      });
    }

    if (currentText.toLowerCase().includes('code') || /[{}();]/.test(currentText)) {
      suggestions.push({
        blockId: 'core:code',
        name: 'Code',
        reason: 'Detected code-like content'
      });
    }

    if (currentText.endsWith('?')) {
      suggestions.push({
        blockId: 'core:heading_3',
        name: 'Heading',
        reason: 'Questions often make good headings'
      });
    }

    // Analyze context from previous blocks
    const lastBlockTypes = previousBlocks.slice(-3);
    
    if (lastBlockTypes.includes('core:heading_1') || lastBlockTypes.includes('core:heading_2')) {
      suggestions.push({
        blockId: 'core:paragraph',
        name: 'Text',
        reason: 'Add content after heading'
      });
    }

    if (lastBlockTypes.filter(type => type === 'core:paragraph').length >= 2) {
      suggestions.push({
        blockId: 'core:divider',
        name: 'Divider',
        reason: 'Break up long text sections'
      });
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }
}

// Factory function
export function createBlockTypeDetectionService(registry: BlockRegistry): BlockTypeDetectionService {
  return new BlockTypeDetectionService(registry);
}