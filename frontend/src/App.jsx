import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function Icon({ name, size = 18, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2Z" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6" /><path d="M2 12v3m20-3v3" /></>,
    arrowDown: <><path d="M12 5v14m-7-7 7 7 7-7" /></>,
  };

  return <svg {...common}>{paths[name] || paths.sparkles}</svg>;
}

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messageRefs = useRef({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`);
      if (!response.ok) throw new Error("Failed to load conversations");
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversation = async (id) => {
    if (loading) return;
    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`);
      if (!response.ok) throw new Error("Failed to load conversation");
      const data = await response.json();
      setConversationId(data.conversation.id);
      setMessages(
        (data.messages || []).map((message) => ({
          role: message.role,
          content: message.content,
        }))
      );
      setMobileSidebarOpen(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setEditingConversationId(null);
    setEditedTitle("");
    setMobileSidebarOpen(false);
    inputRef.current?.focus();
  };

  const handleRenameConversation = async (id) => {
    const title = editedTitle.trim();
    if (!title) {
      alert("Conversation title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to rename conversation.");
      setEditingConversationId(null);
      setEditedTitle("");
      await loadConversations();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteConversation = async (id, title) => {
    const confirmed = window.confirm(
      `Delete "${title || `Chat ${id}`}"? This will permanently delete its messages.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to delete conversation.");

      if (id === conversationId) clearChat();
      if (editingConversationId === id) {
        setEditingConversationId(null);
        setEditedTitle("");
      }
      await loadConversations();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSend = async (promptOverride) => {
    const userMessage = (promptOverride ?? input).trim();
    if (!userMessage || loading) return;

    const newUserMessage = { role: "user", content: userMessage };
    const conversation = [
      ...messages.filter((message) => message.role === "user" || message.role === "assistant"),
      newUserMessage,
    ];
    const assistantIndex = conversation.length;

    setMessages([...conversation, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Something went wrong.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Keep the fallback message for non-JSON errors.
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error("Streaming is not supported by this response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamFinished = false;

      while (!streamFinished) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          streamFinished = true;
        } else {
          buffer += decoder.decode(value, { stream: true });
        }

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          const dataLine = eventText.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const event = JSON.parse(dataLine.slice(6));

          if (event.conversation_id) {
            setConversationId(event.conversation_id);
            await loadConversations();
          }

          if (event.token) {
            setMessages((previousMessages) =>
              previousMessages.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: message.content + event.token }
                  : message
              )
            );
          }

          if (event.error) throw new Error(event.error);
          if (event.done) {
            streamFinished = true;
            break;
          }
        }
      }
    } catch (error) {
      setMessages((previousMessages) =>
        previousMessages.map((message, index) =>
          index === assistantIndex
            ? { ...message, content: message.content || `Error: ${error.message}` }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // const handleCopy = async (content, index) => {
  //   try {
  //     await navigator.clipboard.writeText(content);
  //     setCopiedMessageIndex(index);
  //     setTimeout(() => setCopiedMessageIndex(null), 1600);
  //   } catch (error) {
  //     console.error("Unable to copy message:", error);
  //   }
  // };



  const handleCopy = async (content, index) => {
    try {
      const element = messageRefs.current[index];

      // Use the rendered response, not the raw Markdown.
      if (!element) {
        await navigator.clipboard.writeText(content);
      } else {
        const html = element.innerHTML;
        const plainText = element.innerText;

        if (navigator.clipboard.write && window.ClipboardItem) {
          const clipboardItem = new ClipboardItem({
            "text/html": new Blob([html], {
              type: "text/html",
            }),
            "text/plain": new Blob([plainText], {
              type: "text/plain",
            }),
          });

          await navigator.clipboard.write([clipboardItem]);
        } else {
          // Fallback for browsers without rich clipboard support.
          await navigator.clipboard.writeText(plainText);
        }
      }

      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 1600);
    } catch (error) {
      console.error("Unable to copy message:", error);
    }
  };



  const starterPrompts = [
    { icon: "✦", title: "Explain a concept", detail: "Make a complex topic easy to understand", prompt: "Explain a complex topic in simple terms." },
    { icon: "</>", title: "Help me code", detail: "Debug, write, or improve a program", prompt: "Help me write and understand a piece of code." },
    { icon: "↗", title: "Explore an idea", detail: "Brainstorm possibilities and next steps", prompt: "Help me brainstorm ideas for a project." },
    { icon: "✎", title: "Write something", detail: "Draft, refine, or organize your thoughts", prompt: "Help me draft and improve a piece of writing." },
  ];

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-[#11131b] text-slate-200">
      <div className="flex items-center justify-between px-5 pb-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-950/40">
            <Icon name="sparkles" size={21} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">Orbit AI</div>
            <div className="mt-0.5 text-[11px] tracking-[0.16em] text-slate-500">YOUR AI WORKSPACE</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setMobileSidebarOpen(false); }}
          className="hidden rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <Icon name="chevron" size={17} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={clearChat}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white shadow-sm transition duration-200 hover:border-violet-400/40 hover:bg-violet-500/10"
        >
          <Icon name="plus" size={17} />
          New conversation
        </button>
      </div>

      <div className="px-5 pb-2 pt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Your conversations <span className="ml-1 text-slate-600">· {conversations.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {conversations.length === 0 ? (
          <div className="mx-2 mt-2 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-slate-500">
              <Icon name="message" />
            </div>
            <p className="text-xs leading-5 text-slate-500">Your conversations will show up here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group rounded-xl border transition ${conversation.id === conversationId
                  ? "border-violet-400/20 bg-violet-400/[0.10]"
                  : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.04]"
                  }`}
              >
                {editingConversationId === conversation.id ? (
                  <form
                    onSubmit={(event) => { event.preventDefault(); handleRenameConversation(conversation.id); }}
                    className="p-2"
                  >
                    <input
                      autoFocus
                      value={editedTitle}
                      maxLength={100}
                      onChange={(event) => setEditedTitle(event.target.value)}
                      aria-label="Conversation title"
                      className="w-full rounded-lg border border-violet-400/40 bg-[#0b0d13] px-2.5 py-2 text-xs text-white outline-none ring-violet-400/20 focus:ring-4"
                    />
                    <div className="mt-2 flex gap-2">
                      <button type="submit" className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-400">Save</button>
                      <button
                        type="button"
                        onClick={() => { setEditingConversationId(null); setEditedTitle(""); }}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/15"
                      >Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => loadConversation(conversation.id)}
                      disabled={loading}
                      title={conversation.title}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left text-[13px] text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="message" size={15} className={conversation.id === conversationId ? "shrink-0 text-violet-300" : "shrink-0 text-slate-600"} />
                      <span className="block truncate">{conversation.title || `Chat ${conversation.id}`}</span>
                    </button>
                    <div className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="button"
                        title="Rename conversation"
                        aria-label={`Rename ${conversation.title || `Chat ${conversation.id}`}`}
                        disabled={loading}
                        onClick={() => { setEditingConversationId(conversation.id); setEditedTitle(conversation.title || ""); }}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                      ><Icon name="edit" size={14} /></button>
                      <button
                        type="button"
                        title="Delete conversation"
                        aria-label={`Delete ${conversation.title || `Chat ${conversation.id}`}`}
                        disabled={loading}
                        onClick={() => handleDeleteConversation(conversation.id, conversation.title)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
                      ><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-semibold text-white">O</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-200">Personal workspace</div>
            <div className="mt-0.5 text-[11px] text-slate-500">Local development</div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" title="Local workspace active" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      {sidebarOpen && (
        <aside className="hidden w-[286px] shrink-0 lg:block">
          {sidebarContent}
        </aside>
      )}

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />
          <aside className="relative h-full w-[min(86vw,320px)] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) setMobileSidebarOpen(true);
                else setSidebarOpen((open) => !open);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Toggle conversation sidebar"
              title="Toggle sidebar"
            >
              <Icon name="menu" />
            </button>
            {!sidebarOpen && (
              <button
                type="button"
                onClick={clearChat}
                className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:inline-flex"
              ><Icon name="plus" size={16} /> New chat</button>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">
                {conversationId
                  ? conversations.find((item) => item.id === conversationId)?.title || "Your conversation"
                  : "New conversation"}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                AI assistant <span className="text-slate-300">/</span> Ready to help
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 sm:px-4 sm:text-sm"
          >
            <Icon name="plus" size={16} />
            <span className="hidden xs:inline">New chat</span>
            <span className="xs:hidden">New</span>
          </button>
        </header>

        <section className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_65%)]" />
          <div className={`relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-7 ${messages.length === 0 ? "justify-center pb-12 pt-8" : "pb-8 pt-8"}`}>
            {messages.length === 0 ? (
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-7 flex justify-center">
                  <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-[24px] bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-xl shadow-violet-500/20">
                    <Icon name="sparkles" size={31} />
                    <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-[#f7f8fc] bg-emerald-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600">A little more clarity, a lot more possibility</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                    What can we <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">think through</span> today?
                  </h1>
                  <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
                    Ask a question, untangle a tricky problem, or turn a half-formed idea into a plan.
                  </p>
                </div>

                <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {starterPrompts.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleSend(item.prompt)}
                      disabled={loading}
                      className="group flex min-h-[108px] items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-[0_12px_30px_rgba(91,72,180,0.09)] disabled:opacity-50 sm:p-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-semibold text-violet-600 transition group-hover:bg-violet-100">{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-800">{item.title}</span>
                        <span className="mt-1.5 block text-xs leading-5 text-slate-500">{item.detail}</span>
                      </span>
                      <Icon name="chevron" size={16} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
                    </button>
                  ))}
                </div>
                <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <Icon name="sparkles" size={13} />
                  Thoughtful answers start with good questions.
                </div>
              </div>
            ) : (
              <div className="w-full space-y-7">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex gap-3.5 sm:gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {msg.role === "user" ? (
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-xs font-semibold text-slate-600">You</div>
                    ) : (
                      <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${msg.content.startsWith("Error:") ? "bg-rose-500" : "bg-gradient-to-br from-violet-500 to-indigo-600"}`}>
                        <Icon name={msg.content.startsWith("Error:") ? "close" : "sparkles"} size={17} />
                      </div>
                    )}

                    <div className={`group min-w-0 max-w-[calc(100%-3.25rem)] ${msg.role === "user" ? "max-w-[85%]" : "flex-1"}`}>
                      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${msg.role === "user" ? "justify-end text-slate-500" : "text-slate-700"}`}>
                        {msg.role === "user" ? "You" : msg.content.startsWith("Error:") ? "Something went wrong" : "Orbit AI"}
                        {msg.role !== "user" && msg.content && !msg.content.startsWith("Error:") && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, index)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-normal text-slate-400 opacity-100 transition hover:bg-slate-200/70 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Copy response"
                          >
                            <Icon name="copy" size={12} />
                            {copiedMessageIndex === index ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <div className={`rounded-2xl text-sm leading-7 sm:text-[15px] ${msg.role === "user"
                        ? "rounded-tr-md bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-3 text-white shadow-md shadow-indigo-500/10 sm:px-5"
                        : msg.content.startsWith("Error:")
                          ? "border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700"
                          : "text-slate-800"
                        }`}>
                        {msg.role === "user" ? (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        ) : (
                          // <div className="chat-markdown max-w-none break-words">
                          <div
                            ref={(element) => {
                              messageRefs.current[index] = element;
                            }}
                            className="chat-markdown max-w-none break-words"
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => <h1 className="mb-3 mt-6 text-2xl font-bold tracking-tight text-slate-900 first:mt-0">{children}</h1>,
                                h2: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-bold tracking-tight text-slate-900 first:mt-0">{children}</h2>,
                                h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-slate-900 first:mt-0">{children}</h3>,
                                p: ({ children }) => <p className="mb-4 leading-7 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="mb-4 ml-5 list-disc space-y-1.5 marker:text-violet-500">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-4 ml-5 list-decimal space-y-1.5 marker:font-semibold marker:text-violet-500">{children}</ol>,
                                li: ({ children }) => <li className="pl-1">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                                blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-violet-400 bg-violet-50/60 py-2 pl-4 pr-3 text-slate-600">{children}</blockquote>,
                                a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900">{children}</a>,
                                code: ({ children, className }) => {
                                  const isCodeBlock = className?.startsWith("language-");
                                  if (!isCodeBlock) return <code className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.88em] text-violet-700">{children}</code>;
                                  return <code className={`${className} block min-w-0 font-mono text-[13px] leading-6`}>{children}</code>;
                                },
                                pre: ({ children }) => <pre className="my-4 max-w-full overflow-x-auto rounded-xl border border-slate-800 bg-[#111827] p-4 text-slate-100 shadow-sm">{children}</pre>,
                                table: ({ children }) => <div className="my-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
                                thead: ({ children }) => <thead className="bg-slate-100 text-slate-700">{children}</thead>,
                                th: ({ children }) => <th className="border-b border-slate-200 px-3 py-2.5 font-semibold">{children}</th>,
                                td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2.5 align-top">{children}</td>,
                                hr: () => <hr className="my-6 border-slate-200" />,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                  <div className="flex gap-3.5 sm:gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                      <Icon name="sparkles" size={17} />
                    </div>
                    <div className="pt-2">
                      <div className="mb-3 text-xs font-semibold text-slate-700">Orbit AI is thinking</div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </section>

        <footer className="z-10 shrink-0 border-t border-slate-200/70 bg-white/85 px-3 pb-3 pt-3 backdrop-blur-xl sm:px-7 sm:pb-5">
          <div className="mx-auto max-w-4xl">
            <form
              onSubmit={(event) => { event.preventDefault(); handleSend(); }}
              className="relative rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.07)] transition focus-within:border-violet-300 focus-within:shadow-[0_8px_32px_rgba(124,58,237,0.10)]"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Orbit AI..."
                rows={1}
                disabled={loading}
                className="max-h-40 min-h-[48px] w-full resize-y bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 sm:px-4"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <div className="flex min-w-0 items-center gap-2 pl-2 text-[10px] text-slate-400 sm:text-[11px]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50 text-violet-600"><Icon name="sparkles" size={12} /></span>
                  <span className="truncate">AI can make mistakes. Verify important information.</span>
                </div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none sm:px-4 sm:text-sm"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="send" size={15} />}
                  <span>{loading ? "Thinking" : "Send"}</span>
                </button>
              </div>
            </form>
            <div className="mt-2 text-center text-[10px] text-slate-400 sm:text-[11px]">
              Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-slate-500">Enter</kbd> to send <span className="mx-1.5 text-slate-300">·</span> <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-slate-500">Shift + Enter</kbd> for a new line
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
