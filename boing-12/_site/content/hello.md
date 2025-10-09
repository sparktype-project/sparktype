---
title: Hello
layout: page
date: '2025-08-11'
homepage: true
published: true
description: kj.khjk.kjhkjhjnkjnkj
banner_image:
  serviceId: local
  src: >-
    assets/originals/1759362828536-unltddreamco_httpssmjrun5kwkjzagiue_httpssmjruno9qsxyqm1f_9c84a996-6774-4f20-a2ca-94fb34ade790_2.png
  alt: >-
    unltddreamco_httpss.mj.run5kwkjZAgiuE_httpss.mj.runo9QSXYQM1f_9c84a996-6774-4f20-a2ca-94fb34ade790_2.png
  width: 928
  height: 1232
featured_image:
  serviceId: local
  src: >-
    assets/originals/1759362853846-unltddreamco_httpssmjrundfzkclohxn4_httpssmjrunhhvqtxvegu_2913843e-656d-4950-bd22-6fdf15347f78_1.png
  alt: >-
    unltddreamco_httpss.mj.rundfZKclOHxn4_httpss.mj.runHHvqTXVEGU_2913843e-656d-4950-bd22-6fdf15347f78_1.png
  width: 928
  height: 1232
---

## **Implementation Plan: The "Views" Architecture**

### 1. High-Level Description

This document outlines a significant architectural evolution for Signum, introducing **Views** as a first-class citizen alongside Themes and Layouts. This feature transforms the platform from a page-based system into a more powerful and user-friendly **declarative query and display system**.

The core principle is the separation of concerns:

* **Collections (`Data`):** Pure, un-styled buckets of content (e.g., "Blog Posts," "Projects"). By default, they do not have a public-facing page.
* **Layouts (`Presentation`):** Templates focused solely on rendering a _single item_ of content (e.g., a full article, a project case study).
* **Views (`Query & Aggregation`):** Configurable "recipes" that generate pages by fetching, sorting, and displaying content from one or more Collections, using the appropriate Layouts for presentation.

This model empowers users to create complex, data-driven pages like blog indexes, galleries, and dashboards through a simple graphical interface, without writing code or complex configuration files.

### 2. The User Workflow

The implementation will be designed around the following intuitive user flow:

1. **Start Creation:** The user clicks the "New Page" button in the main file tree navigation.
2. **Choose Page Intent:** A modal appears, asking the user to select the page type:

   * **Content Page:** For creating a standard, static page with manually written content (e.g., "About Us," "Privacy Policy").
   * **View Page:** For creating a page that automatically lists content from collections (e.g., "Blog," "Portfolio").
3. **Configure the Page:**

   * **If "View Page" is selected:**

     * The user enters a **Page Title** (e.g., "Latest News"). The URL slug is auto-generated.
     * They select a **View** from a list of available view types (e.g., "Simple List," "Grid Gallery").
     * A dynamic form appears, based on the selected View's schema. Here, the user configures the query:

       * **Source Collection:** A dropdown lists all existing collections in their site.
       * **Sort Criteria:** "Date," "Title," etc.
       * **Display Options:** Any other options defined by the View (e.g., "Items per Page").
   * **If "Content Page" is selected:**

     * The user enters a **Page Title**. The URL slug is auto-generated.
     * They select a **Layout** from a list of available content layouts (e.g., "Article," "Contact Form Page").
     * (Optional) They select a **Parent Page** to immediately nest the new page.
4. **Finalize and Redirect:**

   * Upon creation, a `View Page` adds a `view` node to the site structure in the manifest. **No `.md` file is created.** The user is redirected to the live preview of their new list page.
   * Upon creation, a `Content Page` adds a `page` node to the manifest and creates a corresponding blank `.md` file. The user is redirected directly to the editor for that new page.

### 3. Phased Implementation Plan

This is a major feature that should be rolled out in distinct, manageable phases.

#### **Phase 1: Foundational Architecture & Data Structures**

**Goal:** Establish the `View` as a core asset type and enable the rendering engine to process it. All testing in this phase will be done by manually editing the manifest files.

1. **New Directory Structure:** Create the `/public/views/` directory. Populate it with at least one example, like `/public/views/list/`, containing:

   * `view.json`: The manifest defining the view's name, icon, and the all-important `schema` for its configuration form.
   * `template.hbs`: The Handlebars template for the view itself.
2. **Update Type Definitions:**

   * In `configHelpers.ts`, create a new `ViewManifest` interface and update the `AssetFileType` union to include `"view"` and `"view-template"`.
   * The `AssetFile` type will now cleanly support this new type.
3. **Update Site Manifest Structure (`types/index.ts`):**

   * A `StructureNode` can now have a `type` of `"view"`.
   * A `view` node will contain `view: string` (the ID of the view asset) and `config: object` (the user's saved query settings).
4. **Refactor `pageResolver.ts`:**

   * Enhance the resolver to recognize `type: "view"`. When it does, it will not look for a Markdown file. Instead, it will trigger a new "query execution" function.
   * **New Query Executor Function:** This utility will take the `view.config` and the full `siteData` as input. It will perform the logic to find the source collection, filter/sort its items, and apply limits. It will return an array of `ParsedMarkdownFile` objects.
   * The resolver will package this result into a new `PageResolutionResult` of `type: PageType.View`.
5. **Refactor `themeEngine.ts`:**

   * The `render` function will add a branch to handle `PageType.View`. It will find and render the correct `view.template.hbs`, passing the queried items into its context.
   * Create the critical `render_layout_for_item` Handlebars helper. This helper will allow a View's template to correctly render each item in its list using the item's own specified Layout (e.g., rendering a blog post with a "post-card" layout).

**Outcome of Phase 1:** The system's backend can render pages generated by Views. The core data flow is established and can be tested programmatically.

***

#### **Phase 2: User Interface for Creating & Configuring Views**

**Goal:** Build the full user workflow described above, allowing non-technical users to create and manage View pages.

1. **New Page Creation Component:** Build a new React component (e.g., `<NewPageDialog />`) that orchestrates the entire multi-step creation flow.
2. **Page Type Selector UI:** The first step in the dialog, presenting the "Content Page" vs. "View Page" choice.
3. **View Configuration UI:**

   * This part of the dialog will dynamically fetch and list all available `Views` from `/public/views/`.
   * Upon selection, it will fetch the chosen `view.json`, parse its `schema`, and render the configuration form using `react-jsonschema-form`.
   * A custom widget must be created for the `source_collection` field to render a dropdown populated from the site's existing collections.
4. **Content Page Configuration UI:**

   * A simpler form for creating standard pages, which includes a dropdown to select a `Layout` (populated from `/public/layouts/`).
5. **Update State Management (`useAppStore`):**

   * Create a new `createViewPage(config)` action that writes a `view` node to the manifest.
   * Refactor the existing `addOrUpdateContentFile` action to be the endpoint for the "Content Page" flow, ensuring it saves the user's chosen `layout`.

**Outcome of Phase 2:** The feature is fully usable by end-users. They can create and manage lists of content declaratively through the editor interface.

***

#### **Phase 3: Advanced Querying and Extensibility**

**Goal:** Enhance the View system with more powerful features based on the solid foundation.

1. **Advanced Filtering:** Extend the query executor and the View schema to support filtering by frontmatter fields (e.g., `tags`, `category`, or a boolean like `featured`).
2. **Pagination:** Implement `limit` and `offset`/`page` logic in the query executor. Pass pagination data (`totalPages`, `nextPageUrl`, etc.) to the view's template context so themes can render pagination controls.
3. **Multi-Collection Views:** Allow the `source_collection` UI to be a multi-select. The query executor would need to be updated to merge, de-duplicate, and sort items from multiple sources, enabling the creation of true homepage dashboards.
4. **User-Created Views:** Explore a UI where advanced users could create and save their own `Views` directly within the Signum editor, effectively building their own reusable query components.

​
