# SparkType Image System Testing Plan

## Executive Summary

The SparkType image handling system spans 5 phases from PlateJS insertion to export. While existing test coverage is good for core services, critical gaps exist in cleanup, integration flows, and error scenarios.

## Current Test Coverage

### Well-Tested Components ✅
- **localImage.service.test.ts** (710 lines) - Comprehensive unit tests for local image operations
- **derivativeCache.service.test.ts** (595 lines) - Cache management and browser compression
- **images.service.test.ts** (305 lines) - Core image service functionality  
- **image.helper.test.ts** (440 lines) - Handlebars template helper rendering
- **imageUrl.helper.test.ts** - URL generation for templates

### Missing Test Coverage ❌
- **imageCleanup.service.ts** - NO TESTS (critical gap - just fixed bug here)
- **PlateJS integration flow** - End-to-end image insertion
- **Export asset bundling** - Image copying to _site directory
- **Cross-phase integration** - Complete flow testing
- **Error recovery scenarios** - IndexedDB failures, corruption
- **Performance under load** - Multiple concurrent operations

## Critical Testing Gaps

### 1. Image Cleanup Service (HIGH PRIORITY)
**Risk**: Service handles orphaned image deletion with complex regex logic
**Recently Fixed**: Critical bug in `extractSourcePathFromDerivative` regex
**Missing Tests**:
```typescript
describe('imageCleanup.service', () => {
  test('should extract correct source paths from derivative paths')
  test('should handle missing source files gracefully')
  test('should preserve referenced images during cleanup')
  test('should clean orphaned derivatives correctly')
  test('should handle IndexedDB errors during cleanup')
  test('should log cleanup operations for debugging')
})
```

### 2. End-to-End Integration (HIGH PRIORITY)
**Risk**: Complex multi-service flow can break at integration points
**Missing Tests**:
```typescript
describe('Image System Integration', () => {
  test('PlateJS insert → storage → derivative → cleanup flow')
  test('Asset export with derivative bundling')
  test('Markdown serialization/deserialization with ImageRefs')
  test('Cross-site image handling and isolation')
})
```

### 3. Error Scenarios (MEDIUM PRIORITY)
**Risk**: System failures are hard to diagnose without proper error handling tests
**Missing Tests**:
```typescript
describe('Error Scenarios', () => {
  test('IndexedDB corruption recovery')
  test('Derivative generation failures')
  test('Export with missing image assets')
  test('Concurrent operation conflicts')
  test('Memory pressure during large image operations')
})
```

## Testing Strategy

### Phase 1: Critical Gap Resolution (Week 1)
1. **Create imageCleanup.service.test.ts**
   - Focus on regex extraction logic
   - Test cleanup scenarios with various path structures
   - Verify error handling doesn't crash cleanup process

2. **Add Integration Test Suite**
   - Create `__tests__/integration/imageFlow.test.ts`
   - Test complete PlateJS → Export flow
   - Mock browser APIs (FileReader, IndexedDB) for consistent testing

### Phase 2: Robustness Testing (Week 2)
1. **Error Recovery Tests**
   - IndexedDB timeout/corruption scenarios
   - Network failures during derivative generation
   - Partial cleanup recovery scenarios

2. **Performance Testing**
   - Concurrent image operations (10+ simultaneous uploads)
   - Large image handling (>10MB files)
   - Memory usage during bulk operations

### Phase 3: Monitoring Implementation (Week 3)
1. **Add Debug Instrumentation**
   - Image operation logging service
   - Performance metrics collection
   - Error categorization and reporting

2. **Create Development Tools**
   - Image system health dashboard component
   - Manual cleanup triggers for development
   - Storage usage monitoring

## Test Implementation Details

### Testing Infrastructure Requirements
```typescript
// Mock utilities for consistent testing
const mockIndexedDB = new FDBFactory();
const mockFileReader = jest.fn();
const mockImageService = createMockImageService();

// Test data generators
const createTestImageBlob = (size: number) => new Blob([...]);
const createTestSiteData = () => ({ ... });
const createTestImageRef = () => ({ ... });
```

### Key Test Scenarios

#### 1. Cleanup Service Tests
```typescript
// Test the fixed regex logic
test('extractSourcePathFromDerivative handles various paths', () => {
  expect(extractSourcePathFromDerivative('assets/images/photo_400x300.jpg'))
    .toBe('assets/images/photo.jpg');
  expect(extractSourcePathFromDerivative('complex/path/image_150x150.png'))
    .toBe('complex/path/image.png');
});

// Test error resilience
test('cleanup continues after individual file errors', async () => {
  // Mock partial failures and verify cleanup doesn't halt
});
```

#### 2. Integration Flow Tests
```typescript
test('complete image lifecycle', async () => {
  // 1. Simulate PlateJS image drop
  const file = createTestImageBlob();
  const imageRef = await uploadImage(siteId, file);
  
  // 2. Verify storage and derivative creation
  const storedImage = await getImageAsset(siteId, imageRef.src);
  expect(storedImage).toBeTruthy();
  
  // 3. Test export bundling
  const exportAssets = await exportSite(siteData);
  expect(exportAssets.images).toContain(imageRef.src);
  
  // 4. Verify cleanup handles referenced vs orphaned
  await cleanupOrphanedImages(siteId);
  const stillExists = await getImageAsset(siteId, imageRef.src);
  expect(stillExists).toBeTruthy(); // Should not be cleaned up
});
```

#### 3. Error Recovery Tests
```typescript
test('IndexedDB corruption recovery', async () => {
  // Simulate IndexedDB timeout
  mockIndexedDB.iterate.mockImplementation(() => 
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 100)));
  
  // Verify recovery process
  await loadAllSiteManifests();
  expect(recoverIndexedDB).toHaveBeenCalled();
});
```

## Success Metrics

### Code Coverage Targets
- **imageCleanup.service.ts**: 80%+ line coverage
- **Integration tests**: Cover all 5 phases of image handling
- **Error scenarios**: 10+ failure modes tested

### Quality Gates
- All tests pass in CI/CD
- No ImageRef memory leaks during testing
- Performance benchmarks within acceptable ranges
- Error logging provides actionable debugging information

### Monitoring Capabilities
- Real-time image operation tracking
- Storage usage alerts
- Automatic corruption detection
- Performance regression alerts

## Implementation Priority

1. **🔥 URGENT**: imageCleanup.service.test.ts (addresses immediate testing gap)
2. **📋 HIGH**: Integration test suite (ensures system reliability)
3. **⚠️ MEDIUM**: Error scenario coverage (improves debugging)
4. **📊 LOW**: Performance and monitoring tools (operational excellence)

This plan ensures the image system becomes fully testable, debuggable, and maintainable while addressing the critical gaps discovered during the system analysis.