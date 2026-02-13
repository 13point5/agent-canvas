import { create } from "zustand";

export type MentionType = "shape" | "file";

export interface MentionToken {
  id: string;
  type: MentionType;
  label: string;
  ref: string;
}

interface ChatComposerStore {
  pendingMentions: MentionToken[];
  pushMention: (mention: MentionToken) => void;
  clearMentions: () => void;
}

export const useChatComposerStore = create<ChatComposerStore>((set) => ({
  pendingMentions: [],
  pushMention: (mention) => {
    set((state) => {
      const exists = state.pendingMentions.some((token) => token.id === mention.id);
      if (exists) return state;
      return { pendingMentions: [...state.pendingMentions, mention] };
    });
  },
  clearMentions: () => set({ pendingMentions: [] }),
}));
