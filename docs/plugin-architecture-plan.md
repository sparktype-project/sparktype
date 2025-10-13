# Sparktype Plugin Architecture Plan

## Current Architecture Analysis

### Tight Coupling Identified
- **State Management**: Features deeply integrated into core Zustand slices (contentSlice.ts)
- **UI Components**: Hardcoded imports across multiple touch points
- **Routes**: Fixed routing in App.tsx without dynamic registration
- **Services**: Features directly coupled to core manifest structure

### Existing Plugin-Like Patterns
- **Publishing Providers**: Already use BaseProvider pattern with interface-based architecture
- **Lazy Loading**: Routes already use React.lazy for code splitting
- **Service Pattern**: Consistent CRUD operations across tag groups and collections

## Plugin System Design

### Core Plugin Interface
```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  
  // Lifecycle hooks
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  
  // Extension points
  routes?: RouteExtension[];
  sidebarSections?: SidebarExtension[];
  frontmatterSections?: FrontmatterExtension[];
  services?: ServiceExtension[];
  stateSlices?: StateSliceExtension[];
  exportHandlers?: ExportExtension[];
}
```

### Hook Points & Extension System

1. **Route Extensions**: Dynamic route registration
2. **Sidebar Extensions**: Left sidebar accordion sections
3. **Frontmatter Extensions**: Right sidebar form sections  
4. **State Extensions**: Zustand slice registration
5. **Service Extensions**: Business logic registration
6. **Export Extensions**: Custom export format handlers

## Implementation Roadmap

### Phase 1: Core Plugin Infrastructure
- Create PluginManager service
- Implement plugin registration/deregistration
- Build extension point framework
- Add plugin configuration UI

### Phase 2: Extract Publishing Plugins
- Leverage existing BaseProvider pattern
- Convert Netlify/GitHub providers to plugins
- Minimal refactoring required

### Phase 3: Extract Collections Plugin
- Move collections service to plugin
- Extract UI components and routes
- Implement collection-specific state slice

### Phase 4: Extract Tag Groups Plugin
- Similar approach to collections
- Handle tag integration across frontmatter
- Maintain backward compatibility

## Benefits
- **Modularity**: Clean feature separation
- **Extensibility**: Third-party plugin support  
- **Maintainability**: Reduced core complexity
- **Customization**: Users can enable/disable features

## Technical Implementation Details

### Current Integration Points Analyzed

#### App.tsx Routing Structure
- Hardcoded routes for collections, taggroups, publishing settings
- Already uses lazy loading pattern for pages
- Need dynamic route registration system

#### State Management (useAppStore.ts)
- Features combined into single Zustand store
- Collections and tag groups deeply integrated into contentSlice
- Need plugin-specific state slice registration

#### Publishing System (publishing.service.ts)
- Already uses provider pattern with BaseProvider abstract class
- Switch-based provider selection and delegation
- Good foundation for plugin architecture

#### UI Integration Points
- LeftSidebar.tsx: Direct imports of CollectionsManager, TagGroupsManager
- FrontmatterSidebar.tsx: Hardcoded feature components in accordion
- Need extension point system for UI components

#### Service Architecture
- collections.service.ts: CRUD operations on manifest data
- tagGroups.service.ts: Similar pattern with manifest-based storage
- Services follow consistent patterns suitable for plugin extraction

### Plugin Candidate Analysis

1. **Publishing Providers** (Low complexity)
   - Already follows plugin pattern
   - Minimal refactoring needed
   - Good proof of concept

2. **Collections** (Medium complexity)
   - Service layer well-defined
   - UI components clearly bounded
   - State integration requires careful extraction

3. **Tag Groups** (Medium complexity)
   - Similar to collections
   - Cross-feature integration in frontmatter
   - Backward compatibility considerations

## Conclusion

The publishing system already demonstrates this pattern works well. Collections and tag groups follow similar service patterns, making extraction feasible with moderate complexity. The main challenge will be creating the dynamic extension point system for routes, UI components, and state management.