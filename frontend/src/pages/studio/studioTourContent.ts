/**
 * Document Studio guided tour.
 *
 * Built by `buildStudioTourConfig` so slides can open/close the New-document
 * dialog and the version panel while touring.
 */
import type { Ww360TourConfig, Ww360TourSlide } from '@/components/ww360/Ww360TourOverlay';

export const STUDIO_TOUR_DISMISSED_KEY = 'ww360-studio-tour-dismissed';
export const STUDIO_TOUR_STEP_KEY = 'ww360-studio-tour-step';
export const STUDIO_TOUR_OPEN_EVENT = 'ww360-open-studio-tour';

export interface StudioTourHooks {
  openNewDialog: () => void;
  closeNewDialog: () => void;
  showVersions: () => void;
  hideVersions: () => void;
  /** Ensure a document is open in the editor (select first or create a sample). */
  ensureDocumentOpen: () => Promise<void>;
}

export function buildStudioTourSlides(hooks: StudioTourHooks): Ww360TourSlide[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to Document Studio',
      body: 'This is where One Water Workforce content gets written — regional briefs, cohort plans, EPA quarterly narratives, utility invitations and newsletters. Everything you create here lives in a shared program library, versioned and exportable to PDF or Word.',
      tip: 'Reopen this tour any time from the Tour button in the header.',
      before: () => {
        hooks.closeNewDialog();
        hooks.hideVersions();
      },
    },
    {
      id: 'folders',
      title: 'The program library',
      body: 'Folders keep content organized by purpose: Program briefs, Training & cohorts, Grant reporting, Outreach and Templates. Add your own folders or nest them. "All documents" and "Unfiled" are always available.',
      highlight: '[data-tour="studio-folders"]',
      tip: 'Deleting a folder never deletes documents — they move up a level.',
    },
    {
      id: 'documents',
      title: 'Documents in this folder',
      body: 'Each card shows status (draft or published), the current version number, word count and when it was last touched. Search looks inside titles and body text, not just names.',
      highlight: '[data-tour="studio-documents"]',
    },
    {
      id: 'new',
      title: 'Start from a template',
      body: 'New document opens a gallery of starting points written for this program — a regional workforce brief with its by-the-numbers table, a cohort plan with a readiness checklist, an EPA Area 3 narrative mapped to Tasks 1–4, an invitation letter, a newsletter. Or begin blank.',
      highlight: '[data-tour="studio-template-gallery"]',
      tip: 'Templates are just a first draft — change anything.',
      before: () => hooks.openNewDialog(),
    },
    {
      id: 'editor',
      title: 'Write like a document, not a form',
      body: 'The editor behaves like a modern word processor. Type / on an empty line to insert headings, lists, checklists, callouts, tables or dividers. Select text to get a quick formatting bar. Paste or drag an image straight in.',
      highlight: '[data-tour="studio-editor"]',
      before: async () => {
        hooks.closeNewDialog();
        await hooks.ensureDocumentOpen();
      },
    },
    {
      id: 'toolbar',
      title: 'Formatting and building blocks',
      body: 'Headings, emphasis, highlight, alignment, lists and checklists, callouts, code, links, tables and images are all one click away. The "Insert section from template" menu drops a whole template section — say the EPA measures table — into the document you already have open.',
      highlight: '[data-tour="studio-toolbar"]',
      tip: 'Click inside a table to get row and column controls.',
    },
    {
      id: 'save',
      title: 'Saves and versions',
      body: 'Your work autosaves a couple of seconds after you stop typing. Pressing Save cuts a numbered version you can come back to. Version history lists every save, publish and restore, and any version can be restored without losing the current one.',
      highlight: '[data-tour="studio-versions"]',
      before: () => hooks.showVersions(),
    },
    {
      id: 'publish',
      title: 'Draft, then publish',
      body: 'Documents start as drafts. Publishing marks the version that partners and staff should treat as final and records who published and when. You can keep editing — the next publish supersedes it.',
      highlight: '[data-tour="studio-status"]',
      before: () => hooks.hideVersions(),
    },
    {
      id: 'export',
      title: 'Export to PDF, Word or Markdown',
      body: 'Export renders the document with Water Workforce 360 branding — headings, tables, checklists and images included. PDF for funders and boards, Word for partners who want to edit, Markdown for the web team, or open a print view.',
      highlight: '[data-tour="studio-export"]',
    },
    {
      id: 'import',
      title: 'Bring in what you already have',
      body: 'Import converts Word, PDF, Markdown or text files into editable documents so existing reports and letters can be updated here instead of re-typed.',
      highlight: '[data-tour="studio-import"]',
    },
    {
      id: 'done',
      title: 'Whose content is this?',
      body: 'Program partners and platform admins share the One Water Workforce library. Utilities that enroll get their own private library — their records stay theirs. Anyone signed in can read; authoring and publishing follow program and district roles.',
      tip: 'A good first document: the regional workforce brief for the region you are visiting next.',
    },
  ];
}

export function buildStudioTourConfig(hooks: StudioTourHooks): Ww360TourConfig {
  return {
    id: 'studio',
    label: 'Document Studio',
    slides: buildStudioTourSlides(hooks),
    dismissedKey: STUDIO_TOUR_DISMISSED_KEY,
    stepKey: STUDIO_TOUR_STEP_KEY,
    eventName: STUDIO_TOUR_OPEN_EVENT,
  };
}
