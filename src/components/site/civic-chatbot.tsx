import { useState, useEffect, useRef } from "react";
import { CivicReport } from "@/lib/civic-data";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  source?: string;
  model?: string;
};

interface CivicChatbotProps {
  user?: {
    username?: string;
    displayName?: string;
    role?: string;
  } | null;
  reports?: CivicReport[];
  variant?: "inline" | "floating";
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Track my complaint status",
  "What are the emergency helpline numbers?",
  "How fast will water leaks in Ward 12 be resolved?",
  "How do I submit a new civic report?",
  "Who is the corporator for Hassan Central?",
];

export function CivicChatbot({
  user,
  reports = [],
  variant = "inline",
  className = "",
}: CivicChatbotProps) {
  const citizenName = user?.displayName || user?.username || "Citizen";

  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: "msg-welcome",
        role: "assistant",
        content: `Hi ${citizenName}! 👋 I am **PulseBot**, your 24/7 Civic Assistant. \n\nI can track your active complaints, explain municipal repair timelines (SLAs), share emergency helplines, or guide you through filing a new report. How can I assist you right now?`,
        time: "Just now",
        source: "PulseBot AI Engine",
        model: "openai/gpt-oss-120b",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState("openai/gpt-oss-120b");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          citizenContext: {
            username: citizenName,
            reports: reports.slice(0, 5).map((r) => ({
              id: r.id,
              title: r.title,
              status: r.status,
              category: r.category,
              ward: r.ward,
              area: r.area,
              priority: r.priority,
              createdAt: r.createdAt,
            })),
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content:
            data.reply ||
            "I received your query. How else may I assist you with municipal services?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          source: data.source || "PulseBot AI Engine",
          model: data.model || activeModel,
        };
        if (data.model) setActiveModel(data.model);
        setMessages((prev) => [...prev, botReply]);
      } else {
        throw new Error("Unable to reach PulseBot AI");
      }
    } catch {
      // Deterministic client fallback if network interrupts
      const botReply: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: `I'm currently assisting you in offline-ready mode. \n\nFor urgent municipal help in Hassan:\n- 🚨 **Central Control Room**: 08172-268000\n- 🚰 **Water Helpline**: 1800-425-0101\n- ⚡ **BESCOM Electricity**: 1912\n\nYou can also click on any report card on this dashboard to see real-time updates!`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: "Local Civic Assistant",
      };
      setMessages((prev) => [...prev, botReply]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `Chat history refreshed! How can I help you today, ${citizenName}?`,
        time: "Just now",
        source: "PulseBot AI Engine",
        model: activeModel,
      },
    ]);
  };

  // Helper to render basic markdown formatting cleanly
  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Headers
          if (line.startsWith("### ")) {
            return (
              <h4
                key={idx}
                className="font-bold text-foreground text-xs uppercase tracking-wide mt-2 pt-1 border-t border-border/40"
              >
                {line.replace("### ", "")}
              </h4>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h3 key={idx} className="font-bold text-foreground text-sm mt-2">
                {line.replace("## ", "")}
              </h3>
            );
          }

          // Bullet points
          if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
            const rawText = line.trim().slice(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-primary mt-1 text-[10px] select-none">●</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(rawText) }} />
              </div>
            );
          }

          // Numbered lists
          const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-bold text-primary text-xs select-none">{numMatch[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(numMatch[2]) }} />
              </div>
            );
          }

          // Tables line separator
          if (line.includes("|---") || line.includes("|:--")) {
            return null;
          }

          // Table row
          if (line.startsWith("|") && line.endsWith("|")) {
            const cells = line.split("|").filter((c, i, a) => i > 0 && i < a.length - 1);
            return (
              <div
                key={idx}
                className="grid grid-cols-3 gap-1 py-1 px-2 my-1 rounded bg-muted/30 text-[11px] font-medium border border-border/40"
              >
                {cells.map((cell, cIdx) => (
                  <span
                    key={cIdx}
                    className={cIdx === 0 ? "font-bold text-foreground" : "text-muted-foreground"}
                  >
                    {cell.trim()}
                  </span>
                ))}
              </div>
            );
          }

          return <p key={idx} dangerouslySetInnerHTML={{ __html: parseBoldText(line) }} />;
        })}
      </div>
    );
  };

  function parseBoldText(text: string): string {
    // Escape first: the text is model output and is injected as HTML below.
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-foreground'>$1</strong>")
      .replace(
        /`([^`]+)`/g,
        "<code class='px-1 py-0.5 rounded bg-muted text-[11px] font-mono text-primary'>$1</code>",
      );
  }

  // Floating button launcher when closed in floating mode
  if (variant === "floating" && !isOpen) {
    return (
      <div className={`fixed bottom-24 right-6 z-[70] sm:bottom-6 ${className}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-primary/95 hover:shadow-primary/25 border-2 border-white/20 active:scale-95"
          aria-label="Open PulseBot Civic Chatbot"
        >
          <div className="relative flex size-6 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span>
            <span className="text-xl">🤖</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase">
              <span>Ask PulseBot</span>
            </div>
            <div className="text-[10px] text-white/80 font-medium">Live Citizen Assistant</div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        variant === "floating"
          ? `fixed bottom-24 right-6 z-[70] sm:bottom-6 w-[92vw] sm:w-[420px] max-h-[75vh] sm:max-h-[85vh] h-[500px] sm:h-[600px] flex flex-col rounded-3xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl overflow-hidden transition-all duration-300 ${className}`
          : `surface-card rounded-2xl border border-border/80 shadow-md flex flex-col h-[560px] overflow-hidden ${className}`
      }
    >
      {/* Chatbot Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-lg shadow-inner">
            <span>🤖</span>
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-surface animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-foreground">PulseBot AI</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Live Citizen Assistant · {citizenName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            title="Clear Chat History"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition text-xs"
          >
            🔄
          </button>
          {variant === "floating" && (
            <button
              onClick={() => setIsOpen(false)}
              title="Close Chat"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="border-b border-border/40 bg-muted/15 px-3 py-2 overflow-x-auto no-scrollbar flex gap-1.5 items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap pl-1">
          Prompt:
        </span>
        {DEFAULT_SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s)}
            disabled={loading}
            className="whitespace-nowrap rounded-lg border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition active:scale-95 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-muted/5 to-transparent">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs shrink-0 mt-0.5">
                🤖
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none font-medium text-xs sm:text-sm"
                  : "bg-surface border border-border/80 text-foreground rounded-tl-none text-xs sm:text-sm"
              }`}
            >
              {m.role === "assistant" ? renderFormattedContent(m.content) : m.content}

              <div
                className={`mt-1.5 flex items-center justify-between gap-3 text-[9px] ${
                  m.role === "user" ? "text-primary-foreground/75" : "text-muted-foreground"
                }`}
              >
                <span>{m.time}</span>
                {m.source && <span className="font-semibold tracking-wide">{m.source}</span>}
              </div>
            </div>

            {m.role === "user" && (
              <div className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">
                👤
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs shrink-0 mt-0.5">
              🤖
            </div>
            <div className="rounded-2xl rounded-tl-none border border-border/80 bg-surface px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-2">
                  <span className="size-2 rounded-full bg-primary animate-ping" />
                </span>
                <span className="text-xs font-semibold text-primary">PulseBot is thinking…</span>
                <div className="flex gap-1 items-center ml-1">
                  <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-1.5 rounded-full bg-primary/60 animate-bounce" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-border/70 bg-surface p-3 sm:p-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={`Ask PulseBot anything about your reports...`}
            className="flex-1 rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Send →"}
          </button>
        </form>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>Press Enter to send · Hassan CMC Grounded</span>
          <span className="font-semibold text-primary">⚡ Ultra-low latency</span>
        </div>
      </div>
    </div>
  );
}
