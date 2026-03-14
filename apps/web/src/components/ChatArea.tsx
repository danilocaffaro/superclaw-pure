'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useSessionStore, type Message } from '@/stores/session-store';
import { useUIStore } from '@/stores/ui-store';
import { useSquadStore } from '@/stores/squad-store';
import { useAgentStore } from '@/stores/agent-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSessionEvents } from '@/hooks/useSessionEvents';

// Split components (was 1311 lines, now modular)
import { MessageBubble, LoadingSkeleton } from './chat/MessageBubble';
import { TypingIndicator } from './chat/TypingIndicator';
import { ChatHeader } from './chat/ChatHeader';
import { SquadChatHeader } from './chat/ChatHeader';
import { ToolChipsBar } from './chat/ToolChipsBar';
import { WelcomeScreen, SquadWelcomeScreen } from './chat/WelcomeScreen';
import { InputBar, type Attachment } from './chat/InputBar';

// ─── Main ChatArea ──────────────────────────────────────────────────────────────

export default function ChatArea({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { messages, activeSessionId, activeSquadId, isStreaming, sendMessage, createSession, messageQueue, addMessage, appendToLastMessage, setStreaming } = useSessionStore();
  const squads = useSquadStore((s) => s.squads);
  const interfaceMode = useUIStore(s => s.interfaceMode);
  const isMobile = useIsMobile();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // ── Global SSE connection (Blueprint Sprint A) ──────────────────────────────
  // When NEXT_PUBLIC_ENABLE_MESSAGE_BUS=true, opens a persistent EventSource to
  // GET /api/sessions/:id/events so ALL agent events arrive in real-time.
  // When flag is off (default), falls back to inline SSE from sendMessage().
  useSessionEvents(activeSessionId, (evt) => {
    if (evt.event === 'message.start' && evt.data) {
      addMessage({
        id: evt.data.id ?? crypto.randomUUID(),
        session_id: activeSessionId!,
        role: 'assistant' as const,
        content: '',
        created_at: new Date().toISOString(),
        agentId: evt.data.agentId,
        agentName: evt.data.agentName,
        agentEmoji: evt.data.agentEmoji,
      });
      setStreaming(true);
    } else if (evt.event === 'message.delta' && evt.data?.text) {
      appendToLastMessage(evt.data.text);
    } else if (evt.event === 'message.finish') {
      setStreaming(false);
    }
  });

  // Count queued messages for active session
  const queuedCount = activeSessionId ? (messageQueue.get(activeSessionId)?.length ?? 0) : 0;

  // Track when activeSessionId changes to show skeleton while messages load
  useEffect(() => {
    if (activeSessionId && messages.length === 0 && !isStreaming) {
      setIsLoadingMessages(true);
      // If no messages arrive within 1s, it's an empty session — stop loading
      const timeout = setTimeout(() => setIsLoadingMessages(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (messages.length > 0 || !activeSessionId) {
      setIsLoadingMessages(false);
    }
  }, [messages, activeSessionId]);

  // When switching sessions/squads → always jump to bottom instantly and re-enable auto-scroll
  useEffect(() => {
    setAutoScroll(true);
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeSessionId, activeSquadId]);

  // When new messages arrive → scroll only if auto-scroll is enabled (user hasn't scrolled up)
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll]);

  // Track manual scroll: if user scrolls up, disable auto-scroll; if at bottom, re-enable
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < 80);
  };

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    // Haptic feedback on mobile
    if (isMobile && navigator.vibrate) navigator.vibrate(10);

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession({ title: content.slice(0, 40) || 'File share' });
      sessionId = session.id;
    }

    // Upload attachments if any
    let messageText = content;
    if (attachments && attachments.length > 0) {
      try {
        const formData = new FormData();
        for (const att of attachments) {
          formData.append('file', att.file);
        }
        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        const json = await res.json();
        const uploaded = json.data || [];

        // Build message with file references
        const fileLines = uploaded.map((f: { name: string; path: string; type: string }) => {
          if (f.type.startsWith('image/')) {
            return `[Image: ${f.name}](file://${f.path})`;
          }
          return `[File: ${f.name}](file://${f.path})`;
        });

        if (fileLines.length > 0) {
          messageText = fileLines.join('\n') + (content ? '\n\n' + content : '');
        }
      } catch (err) {
        console.error('Upload failed:', err);
        // Continue with text only
      }
    }

    if (!messageText) return;
    await sendMessage(sessionId, messageText);
  };

  // Determine what to show
  const hasNoMessages = messages.length === 0;
  const isSquadSession = !!activeSquadId;
  const activeSquad = isSquadSession ? squads.find((s) => s.id === activeSquadId) : null;

  // Welcome: no messages at all (new or empty session)
  const showDefaultWelcome = hasNoMessages && !isLoadingMessages && !activeSquadId;
  // Squad welcome: squad session with no messages yet
  const showSquadWelcome = hasNoMessages && isSquadSession && !!activeSquad;

  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minWidth: isMobile ? 0 : 400,
      background: 'var(--bg)', overflow: 'hidden', flex: 1,
    }}>
      {/* Chat Header — hidden when MobileApp provides its own */}
      {!hideHeader && <ChatHeader />}

      {/* Messages / Welcome */}
      {showDefaultWelcome ? (
        <WelcomeScreen onSend={handleSend} />
      ) : showSquadWelcome && activeSquad ? (
        <SquadWelcomeScreen squad={activeSquad} onSend={handleSend} />
      ) : isLoadingMessages ? (
        <LoadingSkeleton />
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 12px' : '16px 24px' }}
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
            <TypingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Tool Chips Bar — Pro mode only, hidden on mobile */}
      {/* ToolChips bar disabled until real data available (B030) */}

      {/* Queue indicator */}
      {queuedCount > 0 && (
        <div style={{
          textAlign: 'center', padding: '4px 0', fontSize: 11,
          color: 'var(--text-muted)', fontStyle: 'italic',
        }}>
          {queuedCount} message{queuedCount > 1 ? 's' : ''} queued — will send when ready
        </div>
      )}

      {/* Input Bar (Liquid Glass) */}
      <InputBar onSend={handleSend} />
    </main>
  );
}
