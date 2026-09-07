/**
 * Document Studio guided tour.
 *
 * Built by `buildStudioTourConfig` so slides can open/close the New-document
 * dialog and the version panel while touring. Copy follows the signed-in
 * audience (program partner, district manager, operator, or read-only viewer).
 */
import {
  tourStorageKey,
  type Ww360TourConfig,
  type Ww360TourSlide,
} from '@/components/ww360/Ww360TourOverlay';
import type { LandingKind } from '@/utils/resolveLandingKind';

export const STUDIO_TOUR_DISMISSED_KEY = 'ww360-studio-tour-dismissed';
export const STUDIO_TOUR_STEP_KEY = 'ww360-studio-tour-step';
export const STUDIO_TOUR_OPEN_EVENT = 'ww360-open-studio-tour';

export type StudioTourAudience = 'program' | 'district' | 'operator' | 'viewer';

export interface StudioTourHooks {
  openNewDialog: () => void;
  closeNewDialog: () => void;
  showVersions: () => void;
  hideVersions: () => void;
  /** Ensure a document is open in the editor (select first or create a sample). */
  ensureDocumentOpen: () => Promise<void>;
  /** Open the versions panel and seed a few sample versions when the list is thin. */
  ensureSampleVersions: () => Promise<void>;
  /** Signed-in user id — scopes localStorage so accounts don't share tour step. */
  userId?: string | number | null;
  audience?: StudioTourAudience;
  canAuthor?: boolean;
  canPublish?: boolean;
  canConnectLibrary?: boolean;
  canCustodyTransfer?: boolean;
  scopeLabel?: string;
}

export function resolveStudioTourAudience(opts: {
  landingKind: LandingKind;
  canAuthor: boolean;
  scope?: string | null;
}): StudioTourAudience {
  if (!opts.canAuthor) return 'viewer';
  if (opts.landingKind === 'operator') return 'operator';
  if (opts.landingKind === 'district' || (opts.scope && opts.scope !== 'program')) {
    return 'district';
  }
  return 'program';
}

type Copy = { title: string; body: string; tip?: string };

function welcomeCopy(audience: StudioTourAudience, scopeLabel: string): Copy {
  switch (audience) {
    case 'operator':
      return {
        title: 'Welcome to Document Studio',
        body: `This is your utility's document space (${scopeLabel}). Use it for SOPs, training notes, and recorded walkthroughs tied to your documentation tasks. Everything stays in your district library — not the statewide program library.`,
        tip: 'Reopen this tour any time from the Tour button in the header.',
      };
    case 'district':
      return {
        title: 'Welcome to Document Studio',
        body: `Write and organize documents for your utility (${scopeLabel}) — SOPs, training plans, succession notes, and recorded tutorials. Your library is private to the district; program partners work in a separate One Water Workforce library.`,
        tip: 'Reopen this tour any time from the Tour button in the header.',
      };
    case 'viewer':
      return {
        title: 'Welcome to Document Studio',
        body: `Browse published documents in ${scopeLabel}. You can open, search, and export what your team has shared. Authoring and recording need a manager or operator role with document access.`,
        tip: 'Reopen this tour any time from the Tour button in the header.',
      };
    default:
      return {
        title: 'Welcome to Document Studio',
        body: 'This is where One Water Workforce content gets written — regional briefs, cohort plans, EPA quarterly narratives, utility invitations and newsletters. Everything you create here lives in a shared program library, versioned and exportable to PDF or Word.',
        tip: 'Reopen this tour any time from the Tour button in the header.',
      };
  }
}

function foldersCopy(audience: StudioTourAudience): Copy {
  switch (audience) {
    case 'operator':
      return {
        title: 'Your district folders',
        body: 'Folders organize work for your utility — operations notes, tutorials, and anything your manager set up. "All documents" and "Unfiled" are always available. Ask a district manager if you need a new folder.',
        tip: 'Deleting a folder never deletes documents — they move up a level.',
      };
    case 'district':
      return {
        title: 'Your utility library',
        body: 'Create folders that match how your plant works — Operations, Training, Tutorials, and anything else your team needs. "All documents" and "Unfiled" are always available.',
        tip: 'Deleting a folder never deletes documents — they move up a level.',
      };
    case 'viewer':
      return {
        title: 'Library folders',
        body: 'Folders group documents in this library. Use "All documents" to browse everything, or pick a folder to narrow the list.',
      };
    default:
      return {
        title: 'The program library',
        body: 'Folders follow how Jenny and partners work: Program briefs, Training & cohorts, Grant reporting, Outreach, Operations (SOPs and notes), Tutorials (recorded walkthroughs), and Templates for blank starters. Add your own folders or nest them. "All documents" and "Unfiled" are always available.',
        tip: 'Deleting a folder never deletes documents — they move up a level.',
      };
  }
}

function documentsCopy(audience: StudioTourAudience): Copy {
  if (audience === 'viewer') {
    return {
      title: 'Documents in this folder',
      body: 'Each card shows status (draft or published), version, word count, and when it was last updated. Search looks inside titles and body text.',
    };
  }
  return {
    title: 'Documents in this folder',
    body: 'Each card shows status (draft or published), the current version number, word count and when it was last touched. Search looks inside titles and body text, not just names.',
    tip: 'Drag a document onto a folder (or Unfiled) to move it — same as Move to folder in the ⋯ menu.',
  };
}

function newDocCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator') {
    return {
      title: 'Start from a template',
      body: 'New document opens starters useful on the plant floor — a blank page, a tutorial shell for a recorded walkthrough, a cohort/training outline, or an SOP layout. Pick one, name it, and create.',
      tip: 'Templates are just a first draft — change anything.',
    };
  }
  if (audience === 'district') {
    return {
      title: 'Start from a template',
      body: 'New document opens starters for utility work — SOPs, tutorials, training plans, and blank pages. Program-wide briefs and EPA narratives live in the partner library; here you write what your district owns.',
      tip: 'Templates are just a first draft — change anything.',
    };
  }
  return {
    title: 'Start from a template',
    body: 'New document opens a gallery of starting points written for this program — a regional workforce brief with its by-the-numbers table, a cohort plan with a readiness checklist, an EPA Area 3 narrative mapped to Tasks 1–4, an invitation letter, a newsletter. Or begin blank.',
    tip: 'Templates are just a first draft — change anything.',
  };
}

function editorCopy(): Copy {
  return {
    title: 'Write like a document, not a form',
    body: 'The editor behaves like a modern word processor. Type / on an empty line to insert headings, lists, checklists, callouts, tables or dividers. Select text to get a quick formatting bar. Paste or drag an image straight in — click it to resize, float, edit the caption, replace, or remove it.',
  };
}

function toolbarCopy(audience: StudioTourAudience): Copy {
  if (audience === 'program') {
    return {
      title: 'Formatting and building blocks',
      body: 'Headings, emphasis, highlight, alignment, lists and checklists, callouts, code, links, tables and images are all one click away. The "Insert section from template" menu drops a whole template section — say the EPA measures table — into the document you already have open.',
      tip: 'Click inside a table to get row and column controls.',
    };
  }
  return {
    title: 'Formatting and building blocks',
    body: 'Headings, emphasis, highlight, alignment, lists and checklists, callouts, links, tables and images are one click away. Use "Insert section from template" when you want a ready-made block in the document you already have open.',
    tip: 'Click inside a table to get row and column controls.',
  };
}

function saveCopy(): Copy {
  return {
    title: 'Saves and versions',
    body: 'Your work autosaves a couple of seconds after you stop typing. Pressing Save cuts a numbered version you can come back to. Version history lists every save, publish and restore, and any version can be restored without losing the current one.',
    tip: 'Fullscreen keeps Save and the formatting bar on screen. Use the camera icon to capture a screenshot into the doc.',
  };
}

function publishCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator') {
    return {
      title: 'Drafts stay with your team',
      body: 'Documents start as drafts. District managers publish the versions staff should treat as final. Keep editing your draft — when it is ready, your manager can publish it from Document Studio.',
    };
  }
  return {
    title: 'Draft, then publish',
    body: 'Documents start as drafts. Publishing marks the version that partners and staff should treat as final and records who published and when. You can keep editing — the next publish supersedes it.',
  };
}

function exportCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator' || audience === 'district') {
    return {
      title: 'Export to PDF, Word or Markdown',
      body: 'Export renders the document with Water Workforce 360 branding — headings, tables, checklists and images included. Use PDF for binders and boards, Word when someone else needs to edit, or open a print view.',
    };
  }
  return {
    title: 'Export to PDF, Word or Markdown',
    body: 'Export renders the document with Water Workforce 360 branding — headings, tables, checklists and images included. PDF for funders and boards, Word for partners who want to edit, Markdown for the web team, or open a print view.',
  };
}

function importCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator') {
    return {
      title: 'Bring in what you already have',
      body: 'Import converts Word, PDF, Markdown or text files into editable documents — handy when you already have an SOP or handout outside WW360.',
    };
  }
  return {
    title: 'Bring in what you already have',
    body: 'Import converts Word, PDF, Markdown or text files into editable documents so existing reports and letters can be updated here instead of re-typed.',
  };
}

function externalLibraryCopy(audience: StudioTourAudience): Copy {
  if (audience === 'district') {
    return {
      title: 'Connect your utility cloud storage',
      body: 'Link OneDrive, Google Drive, or Dropbox to browse and import files, or transfer custody of eligible folders (Workforce & succession, Compliance, Operations) to your organization\'s storage after acknowledging the WW360 custody policy.',
      tip: 'Tutorials, shift logs, and templates stay in WW360 — they are not custody-eligible.',
    };
  }
  return {
    title: 'Connect program cloud storage',
    body: 'Link OneDrive, Google Drive, or Dropbox to browse and import files into the program library, or transfer custody of eligible operational documents to your connected storage after policy acknowledgment.',
    tip: 'Use External library to connect; Transfer custody moves verified copies and schedules local purge after the retention window.',
  };
}

function recordCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator') {
    return {
      title: 'Record a step-by-step tutorial',
      body: 'Record a walkthrough for a documentation task — screen, screen + camera, camera, voice-only, or screenshots-only. Clicks are logged so WW360 can draft a written guide you can edit before your manager publishes it.',
      tip: 'Published tutorials play back in the editor with video (when recorded) and annotated step screenshots.',
    };
  }
  return {
    title: 'Record a step-by-step tutorial',
    body: 'Authors can record a walkthrough straight from Document Studio. Choose screen, screen + camera, camera, voice-only, or screenshots-only capture. Clicks and navigation are logged automatically so WW360 can draft a written guide you can edit before publishing.',
    tip: 'Published tutorials play back in the editor with video (when recorded) and annotated step screenshots.',
  };
}

function modesCopy(audience: StudioTourAudience): Copy {
  if (audience === 'operator') {
    return {
      title: 'Five recording modes',
      body: 'Screen and screen + camera capture narration with video. Voice-only logs steps without video. Screenshots-only grabs frames on each click — useful when video is blocked. Recordings stay in your district library with your other documents.',
    };
  }
  return {
    title: 'Five recording modes',
    body: 'Screen and screen + camera capture narration with video. Voice-only logs steps without video. Screenshots-only grabs frames on each click — ideal when video is unnecessary or blocked in the browser. All modes publish into the same program library as other documents.',
  };
}

function doneCopy(audience: StudioTourAudience): Copy {
  switch (audience) {
    case 'operator':
      return {
        title: 'Your utility owns this library',
        body: 'Documents you create here belong to your district. Program partners use a separate One Water Workforce library. Start with a tutorial or SOP for a task on your operator home checklist.',
        tip: 'Need a folder or a publish? Ask your district manager.',
      };
    case 'district':
      return {
        title: 'Your utility owns this library',
        body: 'District documents stay private to your utility. The One Water Workforce program library is separate for partners and platform admins. Publish drafts when they are ready for staff to treat as final.',
        tip: 'A good first document: an SOP or tutorial for a high-turnover procedure.',
      };
    case 'viewer':
      return {
        title: 'Read what your team published',
        body: 'You can open and export shared documents in this library. Creating, recording, and publishing need an authoring role.',
        tip: 'Use search when you know part of a title or phrase.',
      };
    default:
      return {
        title: 'Whose content is this?',
        body: 'Program partners and platform admins share the One Water Workforce library. Utilities that enroll get their own private library — their records stay theirs. Anyone signed in can read; authoring and publishing follow program and district roles.',
        tip: 'A good first document: the regional workforce brief for the region you are visiting next.',
      };
  }
}

export function buildStudioTourSlides(hooks: StudioTourHooks): Ww360TourSlide[] {
  const audience = hooks.audience ?? 'program';
  const canAuthor = hooks.canAuthor !== false && audience !== 'viewer';
  const canPublish = !!hooks.canPublish;
  const canConnectLibrary = !!hooks.canConnectLibrary;
  const canCustodyTransfer = !!hooks.canCustodyTransfer;
  const scopeLabel = hooks.scopeLabel ?? 'this library';

  const slides: Ww360TourSlide[] = [];

  const w = welcomeCopy(audience, scopeLabel);
  slides.push({
    id: 'welcome',
    title: w.title,
    body: w.body,
    tip: w.tip,
    before: () => {
      hooks.closeNewDialog();
      hooks.hideVersions();
    },
  });

  const f = foldersCopy(audience);
  slides.push({
    id: 'folders',
    title: f.title,
    body: f.body,
    tip: f.tip,
    highlight: '[data-tour="studio-folders"]',
  });

  const d = documentsCopy(audience);
  slides.push({
    id: 'documents',
    title: d.title,
    body: d.body,
    tip: d.tip,
    highlight: '[data-tour="studio-documents"]',
  });

  if (canAuthor) {
    const n = newDocCopy(audience);
    slides.push({
      id: 'new',
      title: n.title,
      body: n.body,
      tip: n.tip,
      highlight: '[data-tour="studio-template-gallery"]',
      before: () => hooks.openNewDialog(),
    });
  }

  const e = editorCopy();
  slides.push({
    id: 'editor',
    title: e.title,
    body: e.body,
    highlight: '[data-tour="studio-editor"]',
    before: async () => {
      hooks.closeNewDialog();
      await hooks.ensureDocumentOpen();
    },
  });

  if (canAuthor) {
    const t = toolbarCopy(audience);
    slides.push({
      id: 'toolbar',
      title: t.title,
      body: t.body,
      tip: t.tip,
      highlight: '[data-tour="studio-toolbar"]',
    });

    const s = saveCopy();
    slides.push({
      id: 'save',
      title: s.title,
      body: s.body,
      tip: s.tip,
      highlight: '[data-tour="studio-versions"]',
      preferredSide: 'left',
      preferredDock: 'bottom',
      before: async () => {
        hooks.closeNewDialog();
        await hooks.ensureSampleVersions();
      },
    });
  }

  // Operators hear how publishing works even without the button; viewers skip it.
  if (canPublish || audience === 'operator') {
    const p = publishCopy(audience);
    slides.push({
      id: 'publish',
      title: p.title,
      body: p.body,
      tip: p.tip,
      highlight: canPublish ? '[data-tour="studio-status"]' : undefined,
      before: () => hooks.hideVersions(),
    });
  }

  const x = exportCopy(audience);
  slides.push({
    id: 'export',
    title: x.title,
    body: x.body,
    highlight: '[data-tour="studio-export"]',
  });

  if (canAuthor) {
    const i = importCopy(audience);
    slides.push({
      id: 'import',
      title: i.title,
      body: i.body,
      highlight: '[data-tour="studio-import"]',
    });

    const r = recordCopy(audience);
    slides.push({
      id: 'record-tutorial',
      title: r.title,
      body: r.body,
      tip: r.tip,
      highlight: '[data-tour="studio-record"]',
    });

    const m = modesCopy(audience);
    slides.push({
      id: 'recording-modes',
      title: m.title,
      body: m.body,
      highlight: '[data-tour="studio-record"]',
    });

    if (canConnectLibrary && audience !== 'operator') {
      const el = externalLibraryCopy(audience);
      slides.push({
        id: 'external-library',
        title: el.title,
        body: el.body,
        tip: el.tip,
        highlight: canCustodyTransfer
          ? '[data-tour="studio-custody-transfer"]'
          : '[data-tour="studio-external-library"]',
      });
    }
  }

  const done = doneCopy(audience);
  slides.push({
    id: 'done',
    title: done.title,
    body: done.body,
    tip: done.tip,
  });

  return slides;
}

export function buildStudioTourConfig(hooks: StudioTourHooks): Ww360TourConfig {
  const uid = hooks.userId;
  const audience = hooks.audience ?? 'program';
  return {
    id: `studio-${audience}-${uid ?? 'anon'}`,
    label: 'Document Studio',
    slides: buildStudioTourSlides(hooks),
    dismissedKey: tourStorageKey(STUDIO_TOUR_DISMISSED_KEY, uid),
    stepKey: tourStorageKey(STUDIO_TOUR_STEP_KEY, uid),
    eventName: STUDIO_TOUR_OPEN_EVENT,
  };
}

/** Page hero copy aligned with the same audience as the tour. */
export function studioHeroCopy(audience: StudioTourAudience): {
  title: string;
  description: string;
} {
  switch (audience) {
    case 'operator':
      return {
        title: 'Document your work for your utility',
        description:
          'SOPs, training notes, and recorded walkthroughs for your documentation tasks — saved in your district library and exportable to PDF or Word.',
      };
    case 'district':
      return {
        title: 'Create documents for your water utility',
        description:
          'SOPs, training plans, tutorials, and operational notes — versioned in your private district library and exportable with Water Workforce 360 branding.',
      };
    case 'viewer':
      return {
        title: 'Browse your library',
        description:
          'Open, search, and export documents shared in this library. Ask a manager if you need to create or record content.',
      };
    default:
      return {
        title: 'Create rich content for the One Water Workforce program',
        description:
          'Briefs, cohort plans, grant narratives, invitations and newsletters — written once, versioned, and exported to PDF or Word with Water Workforce 360 branding.',
      };
  }
}
