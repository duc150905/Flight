import { createStore } from 'zustand/vanilla';
import type { ChatMessage } from './types';

export const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  text: '',
  timestamp: 0,
};

export type AiChatStoreState = {
  messages: ChatMessage[];
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  resetChat: () => void;
};

export const aiChatStore = createStore<AiChatStoreState>((set) => ({
  messages: [INITIAL_GREETING],
  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === 'function' ? updater(state.messages) : updater,
    })),
  resetChat: () => set({ messages: [INITIAL_GREETING] }),
}));

