/**
 * Help Chatbot Component
 * AI-powered chat interface for help and support
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, BookOpen } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { getAuthHeader } from '@/services/authService';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
}

interface ChatResponse {
  response: string;
  sources: string[];
  tokens_used: number;
  error?: string;
}

interface HelpChatbotProps {
  onClose?: () => void;
  /**
   * Optional opening assistant message. Defaults to the generic AquaSafe greeting.
   */
  welcomeMessage?: string;
  /**
   * Optional placeholder for the input textarea.
   */
  placeholder?: string;
  /**
   * Optional list of click-to-send suggested prompts shown above the input.
   * Useful for guided experiences like the Workforce Succession Wizard.
   */
  suggestedPrompts?: string[];
  /**
   * Optional preamble that gets prepended to every user-sent message before
   * it goes to /api/v1/help/chat. The user only sees their typed text in the
   * UI; the preamble travels with the request to bias the assistant.
   *
   * Can be a static string or a function that produces one (handy when the
   * preamble depends on changing parent state, e.g. the current wizard step).
   */
  messagePreamble?: string | (() => string);
  /**
   * When true, render in a compact embedded layout (smaller padding, no
   * keyboard hint footer). Defaults to false to preserve the existing
   * full-height popover behavior.
   */
  compact?: boolean;
}

export const HelpChatbot: React.FC<HelpChatbotProps> = ({
  onClose,
  welcomeMessage,
  placeholder,
  suggestedPrompts,
  messagePreamble,
  compact = false,
}) => {
  const initialWelcome = React.useMemo<ChatMessage>(
    () => ({
      role: 'assistant',
      content:
        welcomeMessage ??
        "Hello! I'm AquaSafe AI Assistant. I can help you with questions about water quality monitoring, compliance, features, and workflows. What would you like to know?",
      timestamp: new Date(),
    }),
    [welcomeMessage]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([initialWelcome]);

  // If the parent updates the welcome message (e.g. the wizard advances a step),
  // reset the conversation to the new context. We only reset when the wizard
  // hasn't engaged the user yet (single welcome message) to avoid wiping
  // mid-conversation history.
  useEffect(() => {
    setMessages(prev => {
      if (prev.length <= 1) {
        return [initialWelcome];
      }
      return prev;
    });
  }, [initialWelcome]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Build conversation history (exclude the local welcome message).
      const welcomeContent = messages[0]?.content;
      const conversationHistory = messages
        .filter(m => m.role !== 'assistant' || m.content !== welcomeContent)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const preamble =
        typeof messagePreamble === 'function' ? messagePreamble() : (messagePreamble ?? '');
      const wireMessage = preamble ? `${preamble}${message}` : message;

      const response = await axios.post<ChatResponse>(
        '/api/v1/help/chat',
        {
          message: wireMessage,
          conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
        },
        {
          headers: getAuthHeader(),
        }
      );
      return response.data;
    },
    onSuccess: data => {
      const newMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setIsLoading(false);
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      // Check if error response has a specific message
      let errorContent =
        "I'm sorry, I encountered an error. Please try again or use the FAQ search for immediate help.";

      if (error.response?.data) {
        // If the response has an error field, use it
        if (error.response.data.error) {
          errorContent = error.response.data.error;
        } else if (error.response.data.detail) {
          errorContent = error.response.data.detail;
        } else if (error.response.data.response) {
          // If it's a ChatResponse with an error
          errorContent = error.response.data.response;
        }
      } else if (error.message) {
        errorContent = error.message;
      }

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    },
  });

  const handleSend = (overrideMessage?: string) => {
    const text = (overrideMessage ?? inputMessage).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (overrideMessage === undefined) {
      setInputMessage('');
    }
    setIsLoading(true);

    chatMutation.mutate(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const handleSourceClick = (sourceId: string) => {
    if (onClose) {
      onClose();
    }
    navigate(`/dashboard/documentation?doc=${sourceId}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div
        className={`flex-1 overflow-y-auto ${compact ? 'p-3 space-y-3' : 'p-4 space-y-4'} bg-gray-50`}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Referenced documentation:</div>
                  <div className="flex flex-wrap gap-1">
                    {message.sources.map((sourceId, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSourceClick(sourceId)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <BookOpen className="w-3 h-3" />
                        {sourceId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`border-t border-gray-200 ${compact ? 'p-3' : 'p-4'} bg-white`}>
        {suggestedPrompts && suggestedPrompts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestedPrompt(prompt)}
                disabled={isLoading}
                className="text-xs bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 border border-blue-200 px-2 py-1 rounded-full transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder ?? 'Ask me anything about AquaSafe...'}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={compact ? 1 : 2}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {!compact && (
          <div className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        )}
      </div>
    </div>
  );
};
