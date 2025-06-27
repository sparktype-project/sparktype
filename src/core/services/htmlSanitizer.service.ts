// src/core/services/htmlSanitizer.service.ts

import DOMPurify from 'dompurify';

/**
 * HTML sanitization service for theme data fields.
 * Removes malicious scripts while preserving safe HTML formatting.
 */
export class HtmlSanitizerService {
  private static readonly ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'div'
  ];

  private static readonly ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    '*': ['class', 'id']
  };

  /**
   * Sanitizes HTML content by removing potentially malicious elements
   * while preserving safe formatting tags.
   */
  static sanitize(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: this.ALLOWED_TAGS,
      ALLOWED_ATTR: Object.values(this.ALLOWED_ATTRIBUTES).flat(),
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true
    });
  }

  /**
   * Sanitizes theme data object recursively, targeting string fields that may contain HTML.
   */
  static sanitizeThemeData(themeData: Record<string, unknown>): Record<string, unknown> {
    if (!themeData || typeof themeData !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(themeData)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeThemeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}