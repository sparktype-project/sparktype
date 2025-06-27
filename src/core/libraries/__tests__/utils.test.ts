/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { slugify, generateSiteId, cn } from '../utils';

describe('utils', () => {
  describe('slugify', () => {
    test('converts text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    test('handles empty string', () => {
      expect(slugify('')).toBe('');
    });

    test('handles null and undefined', () => {
      expect(slugify(null as any)).toBe('');
      expect(slugify(undefined as any)).toBe('');
    });

    test('normalizes accented characters', () => {
      expect(slugify('Café Niño')).toBe('cafe-nino');
      expect(slugify('Åpfel Über')).toBe('apfel-uber');
      expect(slugify('José María')).toBe('jose-maria');
    });

    test('removes special characters', () => {
      expect(slugify('Hello@World#2024!')).toBe('helloworld2024');
      expect(slugify('Price: $99.99')).toBe('price-9999');
      expect(slugify('User & Admin')).toBe('user-admin');
    });

    test('replaces multiple spaces with single dash', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
      expect(slugify('Multiple   Spaces  Here')).toBe('multiple-spaces-here');
    });

    test('replaces multiple dashes with single dash', () => {
      expect(slugify('Hello--World')).toBe('hello-world');
      expect(slugify('Multiple---Dashes')).toBe('multiple-dashes');
    });

    test('trims whitespace', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
      expect(slugify('\t\nHello World\t\n')).toBe('hello-world');
    });

    test('handles numbers', () => {
      expect(slugify('Blog Post 123')).toBe('blog-post-123');
      expect(slugify('2024 Year in Review')).toBe('2024-year-in-review');
    });

    test('handles unicode characters', () => {
      expect(slugify('🎉 Party Time! 🎊')).toBe('party-time');
      expect(slugify('Test 中文 Content')).toBe('test-content');
    });

    test('handles mixed case and special characters', () => {
      expect(slugify('CamelCase-with_underscores')).toBe('camelcase-withunderscores');
      expect(slugify('API v2.0 (Beta)')).toBe('api-v20-beta');
    });

    test('handles very long strings', () => {
      const longText = 'a'.repeat(200);
      const result = slugify(longText);
      expect(result).toBe('a'.repeat(200));
      expect(result.length).toBe(200);
    });
  });

  describe('generateSiteId', () => {
    test('generates site ID with title slug and random string', () => {
      const result = generateSiteId('My Blog');
      expect(result).toMatch(/^my-blog-[a-z0-9]{5}$/);
    });

    test('handles empty title', () => {
      const result = generateSiteId('');
      expect(result).toMatch(/^-[a-z0-9]{5}$/);
    });

    test('truncates long titles', () => {
      const longTitle = 'A'.repeat(100);
      const result = generateSiteId(longTitle);
      
      // Should be truncated to 50 chars + dash + 5 random chars = 56 total
      expect(result.length).toBe(56);
      expect(result).toMatch(/^a{50}-[a-z0-9]{5}$/);
    });

    test('handles special characters in title', () => {
      const result = generateSiteId('My @#$% Blog!');
      expect(result).toMatch(/^my-blog-[a-z0-9]{5}$/);
    });

    test('generates unique IDs for same title', () => {
      const id1 = generateSiteId('Test Blog');
      const id2 = generateSiteId('Test Blog');
      
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-blog-')).toBe(true);
      expect(id2.startsWith('test-blog-')).toBe(true);
    });

    test('handles accented characters', () => {
      const result = generateSiteId('Café Blog');
      expect(result).toMatch(/^cafe-blog-[a-z0-9]{5}$/);
    });

    test('random part is always 5 characters', () => {
      // Test multiple generations to ensure consistency
      for (let i = 0; i < 10; i++) {
        const result = generateSiteId('Test');
        const randomPart = result.split('-').pop();
        expect(randomPart).toHaveLength(5);
        expect(randomPart).toMatch(/^[a-z0-9]{5}$/);
      }
    });

    test('handles edge case of exactly 50 character title', () => {
      const title = 'a'.repeat(50);
      const result = generateSiteId(title);
      expect(result.length).toBe(56); // 50 + 1 dash + 5 random
      expect(result).toMatch(/^a{50}-[a-z0-9]{5}$/);
    });

    test('handles title with only special characters', () => {
      const result = generateSiteId('@#$%^&*()');
      expect(result).toMatch(/^-[a-z0-9]{5}$/);
    });
  });

  describe('cn (className utility)', () => {
    test('merges class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    test('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'hidden')).toBe('base conditional');
    });

    test('handles Tailwind conflicts', () => {
      // twMerge should resolve conflicting Tailwind classes
      expect(cn('px-2', 'px-4')).toBe('px-4');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    test('handles arrays', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });

    test('handles objects', () => {
      expect(cn({ 'class1': true, 'class2': false, 'class3': true })).toBe('class1 class3');
    });

    test('handles empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null)).toBe('');
      expect(cn(undefined)).toBe('');
    });

    test('handles mixed input types', () => {
      expect(cn(
        'base',
        ['array-class'],
        { 'object-class': true },
        true && 'conditional',
        ''
      )).toBe('base array-class object-class conditional');
    });
  });
});