/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { themeDataHelper, rawThemeDataHelper } from '../themeData.helper';
import type { LocalSiteData } from '@/core/types';
import { HtmlSanitizerService } from '../../../htmlSanitizer.service';

// Mock the HTML sanitizer service
jest.mock('../../../htmlSanitizer.service', () => ({
  HtmlSanitizerService: {
    sanitize: jest.fn((html: string) => `sanitized:${html}`)
  }
}));

describe('themeData helpers', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {},
        themeData: {
          footer_text: '<p>Copyright &copy; 2024 Test Site</p>',
          header_announcement: '<div class="alert">Important announcement!</div>',
          plain_text: 'Simple text content',
          number_value: 42,
          boolean_value: true,
          null_value: null,
          undefined_value: undefined
        }
      }
    }
  };

  const mockSiteDataNoThemeData: LocalSiteData = {
    siteId: 'test-site-no-data',
    manifest: {
      siteId: 'test-site-no-data',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {}
      }
    }
  };

  describe('themeData helper', () => {
    let helper: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const helperMap = themeDataHelper(mockSiteData);
      helper = helperMap.themeData;
    });

    test('returns sanitized HTML content for existing field', () => {
      const result = helper.call({}, 'footer_text');
      
      expect(HtmlSanitizerService.sanitize).toHaveBeenCalledWith('<p>Copyright &copy; 2024 Test Site</p>');
      expect(result).toBe('sanitized:<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('returns sanitized HTML content for another field', () => {
      const result = helper.call({}, 'header_announcement');
      
      expect(HtmlSanitizerService.sanitize).toHaveBeenCalledWith('<div class="alert">Important announcement!</div>');
      expect(result).toBe('sanitized:<div class="alert">Important announcement!</div>');
    });

    test('returns string representation of non-string values without sanitization', () => {
      const numberResult = helper.call({}, 'number_value');
      const booleanResult = helper.call({}, 'boolean_value');
      
      expect(numberResult).toBe('42');
      expect(booleanResult).toBe('true');
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalledWith(42);
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalledWith(true);
    });

    test('returns empty string for null values', () => {
      const result = helper.call({}, 'null_value');
      expect(result).toBe('');
    });

    test('returns empty string for undefined values', () => {
      const result = helper.call({}, 'undefined_value');
      expect(result).toBe('');
    });

    test('returns empty string for non-existent field', () => {
      const result = helper.call({}, 'non_existent_field');
      expect(result).toBe('');
    });

    test('returns empty string when no theme data exists', () => {
      const helperMapNoData = themeDataHelper(mockSiteDataNoThemeData);
      const helperNoData = helperMapNoData.themeData;
      
      const result = helperNoData.call({}, 'footer_text');
      expect(result).toBe('');
    });

    test('returns empty string when theme data is not an object', () => {
      const siteDataInvalidThemeData: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: 'invalid-data' as any
          }
        }
      };

      const helperMapInvalid = themeDataHelper(siteDataInvalidThemeData);
      const helperInvalid = helperMapInvalid.themeData;
      
      const result = helperInvalid.call({}, 'footer_text');
      expect(result).toBe('');
    });
  });

  describe('rawThemeData helper', () => {
    let helper: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const helperMap = rawThemeDataHelper(mockSiteData);
      helper = helperMap.rawThemeData;
    });

    test('returns raw HTML content without sanitization', () => {
      const result = helper.call({}, 'footer_text');
      
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalled();
      expect(result).toBe('<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('returns raw content for another field', () => {
      const result = helper.call({}, 'header_announcement');
      
      expect(result).toBe('<div class="alert">Important announcement!</div>');
      expect(HtmlSanitizerService.sanitize).not.toHaveBeenCalled();
    });

    test('returns string representation of non-string values', () => {
      const numberResult = helper.call({}, 'number_value');
      const booleanResult = helper.call({}, 'boolean_value');
      
      expect(numberResult).toBe('42');
      expect(booleanResult).toBe('true');
    });

    test('returns empty string for null values', () => {
      const result = helper.call({}, 'null_value');
      expect(result).toBe('');
    });

    test('returns empty string for undefined values', () => {
      const result = helper.call({}, 'undefined_value');
      expect(result).toBe('');
    });

    test('returns empty string for non-existent field', () => {
      const result = helper.call({}, 'non_existent_field');
      expect(result).toBe('');
    });

    test('returns empty string when no theme data exists', () => {
      const helperMapNoData = rawThemeDataHelper(mockSiteDataNoThemeData);
      const helperNoData = helperMapNoData.rawThemeData;
      
      const result = helperNoData.call({}, 'footer_text');
      expect(result).toBe('');
    });
  });

  describe('helper function signatures', () => {
    test('themeData helper accepts variable arguments', () => {
      const helperMap = themeDataHelper(mockSiteData);
      const helper = helperMap.themeData;
      
      // Should work with multiple arguments (Handlebars can pass extra args)
      const result = helper.call({}, 'footer_text', 'extra_arg', { option: 'value' });
      expect(result).toBe('sanitized:<p>Copyright &copy; 2024 Test Site</p>');
    });

    test('rawThemeData helper accepts variable arguments', () => {
      const helperMap = rawThemeDataHelper(mockSiteData);
      const helper = helperMap.rawThemeData;
      
      // Should work with multiple arguments (Handlebars can pass extra args)
      const result = helper.call({}, 'footer_text', 'extra_arg', { option: 'value' });
      expect(result).toBe('<p>Copyright &copy; 2024 Test Site</p>');
    });
  });

  describe('edge cases', () => {
    test('handles empty string field name', () => {
      const helperMap = themeDataHelper(mockSiteData);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, '');
      expect(result).toBe('');
    });

    test('handles numeric field name', () => {
      const siteDataWithNumericKey: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: {
              '123': 'numeric key value'
            }
          }
        }
      };

      const helperMap = themeDataHelper(siteDataWithNumericKey);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, '123');
      expect(result).toBe('sanitized:numeric key value');
    });

    test('handles object values', () => {
      const siteDataWithObject: LocalSiteData = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          theme: {
            ...mockSiteData.manifest.theme,
            themeData: {
              complex_data: { nested: 'value', count: 5 }
            }
          }
        }
      };

      const helperMap = themeDataHelper(siteDataWithObject);
      const helper = helperMap.themeData;
      
      const result = helper.call({}, 'complex_data');
      expect(result).toBe('[object Object]');
    });
  });
});