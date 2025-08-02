// src/core/components/MigrationPanel.tsx

import React, { useState } from 'react';
import { useMigration } from '@/core/hooks/useMigration';
import { useSiteStore } from '@/core/state/siteStore';

interface MigrationPanelProps {
  siteId: string;
}

/**
 * Development panel for manually triggering content migrations
 */
export function MigrationPanel({ siteId }: MigrationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const { migrateLayout, migrateBlogPostDates } = useMigration();
  const currentSite = useSiteStore(state => state.getSiteById(siteId));

  const runMigration = async (migrationFn: () => Promise<void>, description: string) => {
    if (isRunning) return;
    
    setIsRunning(true);
    try {
      console.log(`Starting migration: ${description}`);
      await migrationFn();
      console.log(`Completed migration: ${description}`);
    } catch (error) {
      console.error(`Migration failed: ${description}`, error);
    } finally {
      setIsRunning(false);
    }
  };

  if (!currentSite) {
    return <div className="text-red-500">Site not found</div>;
  }

  const blogPostCount = currentSite.contentFiles?.filter(f => f.frontmatter.layout === 'blog-post')?.length || 0;
  const blogPostsNeedingMigration = currentSite.contentFiles?.filter(f => 
    f.frontmatter.layout === 'blog-post' && 
    !f.frontmatter.date_published && 
    f.frontmatter.date
  )?.length || 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-4">
      <div className="border-b border-gray-200 pb-2">
        <h3 className="text-lg font-semibold text-gray-900">Content Migration Panel</h3>
        <p className="text-sm text-gray-600">Manually trigger content migrations for layout schema changes</p>
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-3">
          <h4 className="font-medium text-gray-900 mb-2">Blog Post Date Migration</h4>
          <p className="text-sm text-gray-600 mb-3">
            Migrate existing blog posts to use the new <code className="bg-gray-100 px-1 rounded">date_published</code> field.
          </p>
          <div className="text-sm text-gray-500 mb-3">
            <div>Total blog posts: <span className="font-medium">{blogPostCount}</span></div>
            <div>Posts needing migration: <span className="font-medium text-orange-600">{blogPostsNeedingMigration}</span></div>
          </div>
          <button
            onClick={() => runMigration(
              () => migrateBlogPostDates(siteId),
              'Blog post date_published field migration'
            )}
            disabled={isRunning || blogPostsNeedingMigration === 0}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {isRunning ? 'Running...' : blogPostsNeedingMigration > 0 ? 'Migrate Blog Posts' : 'No Migration Needed'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-3">
          <h4 className="font-medium text-gray-900 mb-2">Custom Layout Migration</h4>
          <p className="text-sm text-gray-600 mb-3">
            Run migrations for specific layout changes. Use this when layout schemas are updated.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Layout ID (e.g., blog-post)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="custom-layout-input"
            />
            <button
              onClick={() => {
                const input = document.getElementById('custom-layout-input') as HTMLInputElement;
                const layoutId = input?.value?.trim();
                if (layoutId) {
                  runMigration(
                    () => migrateLayout(siteId, layoutId),
                    `Custom layout migration for: ${layoutId}`
                  );
                }
              }}
              disabled={isRunning}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isRunning ? 'Running...' : 'Migrate Layout'}
            </button>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-700 font-medium">Migration in progress...</span>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
        <p><strong>Note:</strong> This panel is for development purposes. In production, migrations should run automatically when layout schemas change.</p>
      </div>
    </div>
  );
}