---
title: Blog post1
layout: blog-post
date: '2025-08-11'
published: true
featured_image:
  serviceId: local
  src: assets/originals/1754935140540-247.jpg
  alt: 247.jpg
  width: 1740
  height: 1799
description: A guide to the image testing system
---

## &#x20;**Quick Commands**

​

\`\`\`bash# Run all image testsnpm test -- --testPathPatterns="image"

​

\# Watch mode during developmentnpm test -- --watch --testPathPatterns="image"

​

\# Full coverage reportnpm run test\:coverage -- --testPathPatterns="image"

​

# Run specific test suitesnpm test -- localImage.service.test.tsnpm test -- imagePreprocessor.service.test.tsnpm test -- siteBackup.service.test.ts

​

# Run multiple patternsnpm test -- --testPathPatterns="image|storage|siteBackup"\`\`\`

​

**## Before Any Release**

​

\`\`\`bash# MUST PASS before merging image changesnpm test -- src/core/services/images/\_\_tests\_\_/npm test -- --testPathPatterns="backup|import"npm test -- --testPathPatterns="storage-contracts"\`\`\`

​

**## Testing Checklist**

​

**### After Modifying Image Processing**

​

\- \[ ] All unit tests pass: \`npm test -- --testPathPatterns="image"\`- \[ ] Integration tests pass- \[ ] Run health check in browser console: \`\_\_checkImageHealth('site-id')\`- \[ ] Test in both web and Tauri environments- \[ ] Manually verify export structure- \[ ] Check coverage didn't decrease: \`npm run test\:coverage\`

​

**### After Modifying Import/Export**

​

\- \[ ] Import tests pass (media.json-based)- \[ ] Export tests pass (derivative filtering)- \[ ] Contract tests pass (storage architecture)- \[ ] Manual roundtrip test: export → import → export- \[ ] Verify media.json matches storage

​

**### After Modifying URL Generation**

​

\- \[ ] URL generation tests pass for all contexts: \`npm test -- localImage.service.test.ts\`- \[ ] Tauri data URL tests pass- \[ ] Preview (iframe) data URL tests pass- \[ ] Export path tests pass- \[ ] Test in actual Tauri app: \`npm run tauri\:dev\`

​

**## Architecture Invariants**

​

These must **\*\*ALWAYS\*\*** be true:

​

**### 1. Storage Separation**

​

\`\`\`✅ CORRECT:  siteImageAssetsStore:    - assets/originals/image1.jpg    - assets/originals/image2.png

​

&#x20; derivativeCacheStore:    - site-123/assets/derivatives/image1\_w600\_h400\_c-fill\_g-center.jpg    - site-123/assets/derivatives/image2\_w300\_h200\_c-fit\_g-center.png

​

❌ WRONG:  siteImageAssetsStore:    - assets/originals/image1.jpg    - assets/derivatives/image1\_w600\_h400\_c-fill\_g-center.jpg  ← NO!\`\`\`

​

**\*\*Contract\*\***: \`siteImageAssetsStore\` contains ONLY user-uploaded originals. Derivatives are ONLY in \`derivativeCacheStore\`.

​

### **2. URL Formats by Context**

​

\| Context | Format | Example ||---------|--------|---------|| **\*\*Export\*\*** | \`/assets/derivatives/\{file}\` | \`/assets/derivatives/img\_w600\_h400\_c-fill\_g-center.jpg\` || **\*\*Preview (iframe)\*\*** | \`data\:image/...\` | \`data\:image/jpeg;base64,/9j/4AAQ...\` || **\*\*Tauri App\*\*** | \`data\:image/...\` | \`data\:image/png;base64,iVBORw0KGgo...\` || **\*\*Web Editor\*\*** | \`blob:[http://...\`](http://...`) | \`blob\:http\://localhost/abc-123\` |

​

**\*\*Contract\*\***: Each context must use the correct URL format for that environment.

​

**### 3. Import Rules**

​

\`\`\`typescript// ✅ CORRECT: Import from media.jsonconst mediaManifest = JSON.parse(await mediaFile.async('string'));for (const imagePath of Object.keys(mediaManifest.images)) \{  const imageFile = signumFolder.file(\`assets/originals/$\{filename}\`);  imageAssets\[imagePath] = await imageFile.async('blob');}

​

// ❌ WRONG: Scan foldersconst originalsFolder = signumFolder.folder('assets/originals');for (const filename in originalsFolder.files) \{ ... }\`\`\`

​

**\*\*Contract\*\***:- ONLY import images listed in media.json- NEVER import derivatives from ZIP- Derivatives are regenerated on-demand

​

**### 4. Export Structure**

​

\`\`\`\_site/  ├── assets/  │   ├── originals/           ← Only true originals  │   │   ├── 1234-image1.jpg  ✅ No transform params in filename  │   │   └── 5678-image2.png  ✅ No transform params in filename  │   └── derivatives/         ← Only generated derivatives  │       ├── image1\_w600\_h400\_c-fill\_g-center.jpg  ✅ Has transform params  │       └── image2\_w300\_h200\_c-fit\_g-center.jpg   ✅ Has transform params  └── data/      └── media.json           ← Lists only originals\`\`\`

​

**\*\*Contract\*\***:- Originals folder contains NO files with derivative naming pattern- Derivative pattern: \`/\_w(auto|\d+)\_h(auto|\d+)\_c-\[^\_]+\_g-\[^\_]+/\`- media.json keys match exactly with originals in storage

​

**## Manual Verification**

​

**### Test Export Structure**

​

1\. **\*\*Export a site with images\*\***   \`\`\`typescript   const zip = await exportSiteBackup(siteData);   // Save ZIP to disk   \`\`\`

​

2\. **\*\*Extract and inspect\*\***   \`\`\`bash   unzip site-export.zip   cd \_site   ls -la assets/originals/    # Should have NO derivatives   ls -la assets/derivatives/  # Should have derivatives   cat data/media.json         # Should list only originals   \`\`\`

​

3\. **\*\*Verify no derivative contamination\*\***   \`\`\`bash   # This should return NOTHING:   ls assets/originals/ | grep -E '\_w\[0-9]+.\*\_h\[0-9]+.\*\_c-.\*\_g-'   \`\`\`

​

4\. **\*\*Check media.json integrity\*\***   \`\`\`bash   # Extract image paths from media.json   jq '.images | keys\[]' data/media.json

​

&#x20;  \# Compare with actual files in originals folder   ls assets/originals/   \`\`\`

​

**### Test Tauri App**

​

1\. **\*\*Launch Tauri app\*\***   \`\`\`bash   npm run tauri\:dev   \`\`\`

​

2\. **\*\*Upload image and verify\*\***   - Upload an image   - Open DevTools Console   - Look for: \`\[LocalImageService] Creating data URL for Tauri\`   - Image should display without errors

​

3\. **\*\*Verify data URLs\*\***   - Inspect image element in DevTools   - \`src\` attribute should start with \`data\:image/\`   - Should NOT be blob URL

​

4\. **\*\*Test export from Tauri\*\***   - Export site   - Extract ZIP   - Verify structure matches web export

​

**### Test Import Behavior**

​

1\. **\*\*Create a test site with images\*\***   - Add 3-5 images   - Export to ZIP

​

2\. **\*\*Verify export contents\*\***   - Check \`data/media.json\` exists and lists images   - Check \`assets/originals/\` has originals   - Check \`assets/derivatives/\` has derivatives

​

3\. **\*\*Import the ZIP\*\***   \`\`\`typescript   const importedData = await importSiteFromZip(zipFile);   \`\`\`

​

4\. **\*\*Verify imported data\*\***   \`\`\`typescript   // Should contain ONLY originals   console.log(Object.keys(importedData.imageAssetsToSave));   // Should NOT contain any derivative filenames   \`\`\`

​

5\. **\*\*Check storage after save\*\***   \`\`\`typescript   const stored = await getAllImageAssetsForSite(siteId);   // Should contain ONLY originals   // Verify no derivative patterns: /\_w.\*\_h.\*\_c-.\*\_g-/   \`\`\`

​

**## Browser Console Diagnostics**

​

**### Image Health Check**

​

\`\`\`javascript// Run in browser consoleawait \_\_checkImageHealth('your-site-id')

​

// Example output:\{  status: 'healthy',  issues: \[],  metrics: \{    originalsCount: 12,    derivativesCount: 48,    storageSizeMB: 8.4  }}

​

// OR if issues found:\{  status: 'error',  issues: \[    '❌ CRITICAL: Derivative in originals: assets/originals/img\_w600\_h400\_c-fill\_g-center.jpg',    '⚠️  3 images orphaned in storage'  ],  metrics: \{ ... }}\`\`\`

​

**### Quick Checks**

​

\`\`\`javascript// Check if image is in storageawait getImageAsset('site-id', 'assets/originals/image.jpg')

​

// List all cached derivativesawait getAllCacheKeys('site-id')

​

// Get media manifestawait getMediaManifest('site-id')

​

// Check derivative cacheawait getCachedDerivative('site-id/assets/derivatives/img\_w600\_h400.jpg')\`\`\`

​

**## Common Test Failures & Fixes**

​

**### "Derivative found in originals store"**

​

**\*\*Cause\*\***: Import logic saved derivatives to siteImageAssetsStore

​

**\*\*Fix\*\***: Verify \`importSiteFromZip\` only imports from media.json, not from folder scanning

​

**\*\*Test\*\***:\`\`\`typescripttest('should not import derivatives', async () => \{  // ZIP contains derivatives but they should be ignored  const data = await importSiteFromZip(zipWithDerivatives);  const paths = Object.keys(data.imageAssetsToSave);

​

&#x20; for (const path of paths) \{    expect(path).not.toMatch(/\_w.\*\_h.\*\_c-.\*\_g-/);  }});\`\`\`

​

**### "Data URL not returned in Tauri context"**

​

**\*\*Cause\*\***: \`isTauriApp()\` detection failed or getDisplayUrl not checking properly

​

**\*\*Fix\*\***: Mock \`isTauriApp()\` in tests and verify data URL branch

​

**\*\*Test\*\***:\`\`\`typescripttest('should return data URL in Tauri', async () => \{  jest.mock('@/core/utils/platform', () => (\{    isTauriApp: () => true  }));

​

&#x20; const url = await getDisplayUrl(manifest, ref, options, false);  expect(url).toMatch(/^data\:image\\//);});\`\`\`

​

**### "Media.json and storage out of sync"**

​

**\*\*Cause\*\***: Image added/removed but media.json not updated

​

**\*\*Fix\*\***: Ensure media manifest is regenerated on image operations

​

**\*\*Test\*\***:\`\`\`typescripttest('media.json matches storage', async () => \{  const media = await getMediaManifest(siteId);  const stored = await getAllImageAssetsForSite(siteId);

​

&#x20; expect(Object.keys(media.images).sort()).toEqual(    Object.keys(stored).sort()  );});\`\`\`

​

**## Test Coverage Goals**

​

\| Component | Target Coverage | Current ||-----------|----------------|---------|| localImage.service.ts | 90% | Check with \`npm run test\:coverage\` || imagePreprocessor.service.ts | 85% | || derivativeCache.service.ts | 90% | || imageRegistry.service.ts | 85% | || mediaManifest.service.ts | 85% | || siteBackup.service.ts | 80% | || remoteImport.service.ts | 80% | |

​

**## Continuous Integration**

​

**### Local Pre-commit Hook**

​

\`\`\`bash# .husky/pre-commitgit diff --cached --name-only | grep -q "src/core/services/images/" && \{  echo "🧪 Running image tests..."  npm test -- --testPathPatterns="image" --bail}\`\`\`

​

**### CI/CD (Future)**

​

\`\`\`yaml# .github/workflows/test-images.ymlname: Image Testson:  pull\_request:    paths:      - 'src/core/services/images/\*\*'      - 'src/core/services/siteBackup.service.ts'

​

jobs:  test:    runs-on: ubuntu-latest    steps:      - run: npm ci      - run: npm test -- --testPathPatterns="image|backup|import"      - run: npm run test\:coverage\`\`\`

​

**## Resources**

​

\- \[IMAGE\_PIPELINE\_PROCESS.md]\(<u>./IMAGE\_PIPELINE\_PROCESS.md</u>) - Complete pipeline documentation- \[Jest Documentation]\([<u>https://jestjs.io/docs/getting-started</u>](https://jestjs.io/docs/getting-started))- \[Testing Library]\([<u>https://testing-library.com/docs/react-testing-library/intro/</u>](https://testing-library.com/docs/react-testing-library/intro/))

​

**## Questions?**

​

Check existing tests in \`src/core/services/images/\_\_tests\_\_/\` for examples.