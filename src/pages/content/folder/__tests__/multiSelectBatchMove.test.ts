import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FolderManager } from '../manager';
import type { FolderData } from '../types';

vi.mock('@/utils/i18n', () => ({
  getTranslationSync: (key: string) => key,
  getTranslationSyncUnsafe: (key: string) => key,
  initI18n: () => Promise.resolve(),
}));

type TestableManager = {
  data: FolderData;
  sidebarContainer: HTMLElement | null;
  enterMultiSelectMode: (
    initialConversationId?: string,
    source?: 'folder' | 'native',
    folderId?: string,
  ) => void;
  updateMultiSelectModeUI: () => void;
  addConversationsToFolder: (
    folderId: string,
    conversations: Array<{ conversationId: string; title: string; url: string; addedAt: number }>,
    sourceFolderId?: string,
  ) => void;
  exitMultiSelectMode: () => void;
};

function mountNativeSidebar(conversationId: string, title: string): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.setAttribute('data-test-id', 'overflow-container');

  const conversation = document.createElement('div');
  conversation.setAttribute('data-test-id', 'conversation');
  conversation.setAttribute('jslog', `["${conversationId}"]`);

  const titleEl = document.createElement('span');
  titleEl.className = 'conversation-title-text';
  titleEl.textContent = title;
  conversation.appendChild(titleEl);

  const link = document.createElement('a');
  link.href = `https://gemini.google.com/app/${conversationId.replace(/^c_/, '')}`;
  link.setAttribute('aria-label', title);
  conversation.appendChild(link);

  sidebar.appendChild(conversation);
  document.body.appendChild(sidebar);
  return sidebar;
}

describe('multi-select batch move', () => {
  let manager: FolderManager | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager?.destroy();
    manager = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens move dialog from multi-select toolbar and moves selected native conversations', () => {
    manager = new FolderManager();
    const typedManager = manager as unknown as TestableManager;

    const sidebar = mountNativeSidebar('c_abc123', 'Alpha Conversation');
    typedManager.sidebarContainer = sidebar;

    typedManager.data = {
      folders: [
        {
          id: 'target-folder',
          name: 'Target',
          parentId: null,
          isExpanded: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      folderContents: {
        'target-folder': [],
      },
    };

    const addSpy = vi
      .spyOn(typedManager, 'addConversationsToFolder')
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(typedManager, 'exitMultiSelectMode');

    typedManager.enterMultiSelectMode('c_abc123', 'native');
    typedManager.updateMultiSelectModeUI();

    const moveBtn = document.querySelector('.gv-multi-select-move-btn') as HTMLButtonElement | null;
    expect(moveBtn).not.toBeNull();

    moveBtn?.click();

    const overlay = document.querySelector('.gv-folder-dialog-overlay') as HTMLElement | null;
    expect(overlay).not.toBeNull();

    const options = [...document.querySelectorAll<HTMLButtonElement>('.gv-folder-dialog-item')];
    expect(options).toHaveLength(1);
    expect(options[0].dataset.folderId).toBe('target-folder');

    options[0].click();

    expect(addSpy).toHaveBeenCalledTimes(1);
    const [folderId, conversations, sourceFolderId] = addSpy.mock.calls[0];
    expect(folderId).toBe('target-folder');
    expect(sourceFolderId).toBeUndefined();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].conversationId).toBe('c_abc123');
    expect(conversations[0].title).toBe('Alpha Conversation');
    expect(conversations[0].url).toContain('/app/abc123');
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.gv-folder-dialog-overlay')).toBeNull();
  });
});
