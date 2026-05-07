'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Languages } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/context/LanguageContext';
import { clsx } from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    { key: 'zonesAtRisk', text: t('chat.suggestedQuestions.zonesAtRisk') },
    { key: 'topAlerts', text: t('chat.suggestedQuestions.topAlerts') },
    { key: 'bestChargingSites', text: t('chat.suggestedQuestions.bestChargingSites') },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language: language,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader');

      let accumulatedContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: accumulatedContent,
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: t('chat.error'),
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* Chat Panel */}
      {isOpen && (
        <div className="mb-4 w-96 h-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <Bot size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm leading-none">{t('chat.title')}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t('chat.online')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Language Toggler */}
              <div className="flex bg-slate-200/50 p-1 rounded-lg mr-2">
                <button
                  onClick={() => setLanguage('en')}
                  className={clsx(
                    "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                    language === 'en' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('kn')}
                  className={clsx(
                    "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                    language === 'kn' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  KN
                </button>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3 mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                  {language === 'kn' ? 'ನೀವು ಹೀಗೆ ಕೇಳಬಹುದು:' : 'Suggested questions:'}
                </p>
                {suggestedQuestions.map((q) => (
                  <button
                    key={q.key}
                    onClick={() => handleSend(q.text)}
                    className="text-left p-3 text-sm bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:text-blue-600 transition-all shadow-sm group"
                  >
                    <span className={clsx(language === 'kn' && "font-kannada")}>{q.text}</span>
                  </button>
                ))}
              </div>
            )}
            
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  "flex gap-3 max-w-[90%]",
                  m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm",
                  m.role === 'user' ? "bg-blue-600 text-white" : "bg-slate-100 text-blue-600 border border-slate-200"
                )}>
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={clsx(
                  "p-4 rounded-2xl text-sm shadow-sm",
                  m.role === 'user' 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none",
                  m.role === 'assistant' && language === 'kn' && "font-kannada leading-relaxed text-base"
                )}>
                  <div className="whitespace-pre-wrap">
                    {m.content || (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-xs font-medium italic">{t('chat.thinking')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('chat.placeholder')}
                disabled={isLoading}
                className={clsx(
                  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all disabled:opacity-50 shadow-inner",
                  language === 'kn' && "font-kannada"
                )}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition-colors"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-3 font-medium uppercase tracking-tighter">
              Bilingual Intelligence for BESCOM Grid Management
            </p>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110",
          isOpen ? "bg-white text-slate-900 border border-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
};
