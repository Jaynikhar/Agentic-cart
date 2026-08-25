import React, { useEffect, useRef } from 'react';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm bg-white/80 border border-gray-100 shadow-sm w-fit">
    <span className="w-2 h-2 bg-brand-400 rounded-full typing-dot" style={{ animationDelay: '0s' }} />
    <span className="w-2 h-2 bg-brand-400 rounded-full typing-dot" style={{ animationDelay: '0.15s' }} />
    <span className="w-2 h-2 bg-brand-400 rounded-full typing-dot" style={{ animationDelay: '0.3s' }} />
  </div>
);


const renderFormattedContent = (text) => {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Render **bold** segments within a line
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={j}>{part}</React.Fragment>;
    });

    const trimmed = line.trim();
    const isListItem = trimmed.startsWith('- ') || trimmed.startsWith('* ');

    return (
      <div key={i} className={isListItem ? 'flex gap-2 mt-1' : 'mt-0.5'}>
        {isListItem ? (
          <>
            <span className="text-brand-500 shrink-0">•</span>
            <span>{parts.join('').startsWith('- ') ? null : null}
              {(() => {
                // strip the leading "- " or "* " marker before rendering parts
                const stripped = line.replace(/^[\s]*[-*]\s+/, '');
                const strippedParts = stripped.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={j} className="font-semibold">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <React.Fragment key={j}>{part}</React.Fragment>
                  )
                );
                return strippedParts;
              })()}
            </span>
          </>
        ) : (
          parts
        )}
      </div>
    );
  });
};

const ChatBubble = ({ role, content }) => {
  const isUser = role === 'user';
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm shadow-md ${
            isUser
              ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
              : 'bg-gradient-to-br from-purple-400 to-pink-400 text-white'
          }`}
        >
          {isUser ? '🧑' : '🤖'}
        </div>
        <div
          className={`px-4 py-3 text-sm leading-relaxed shadow-sm break-words ${
            isUser
              ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white rounded-2xl rounded-br-sm'
              : 'bg-white/85 text-gray-800 border border-gray-100 rounded-2xl rounded-bl-sm backdrop-blur-sm'
          }`}
        >
          {isUser ? content : renderFormattedContent(content)}
        </div>
      </div>
    </div>
  );
};

const OrderCard = ({ order, onCheckout, isPaying, paymentStatus }) => {
  if (!order) return null;

  return (
    <div className="animate-slide-up flex justify-start">
      <div className="ml-10 w-full max-w-sm glass rounded-2xl p-5 shadow-lg border border-white/60">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
            Order Ready
          </span>
          <span className="text-xs text-gray-400 font-mono">#{order.internalOrderId?.slice(-6)}</span>
        </div>

        <div className="space-y-2 mb-4">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate pr-2">
                {item.quantity} × {item.name}
              </span>
              <span className="font-semibold text-gray-900 shrink-0">{formatINR(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="h-px bg-gray-200 my-3" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-500">Total</span>
          <span className="text-xl font-extrabold text-gray-900">{formatINR(order.totalAmount)}</span>
        </div>

        <button
          onClick={() => onCheckout(order)}
          disabled={isPaying}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 shadow-lg shadow-brand-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPaying ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Processing…
            </>
          ) : (
            <>🔒 Pay Securely with Razorpay</>
          )}
        </button>

        {paymentStatus === 'success' && (
          <p className="text-center text-emerald-600 text-xs font-medium mt-3">✅ Payment successful</p>
        )}
        {paymentStatus === 'failed' && (
          <p className="text-center text-red-500 text-xs font-medium mt-3">❌ Payment failed — try again</p>
        )}
      </div>
    </div>
  );
};

const SUGGESTIONS = [
  'Laptop',
  'Wireless headphones',
  'Gaming console',
  'Smartwatches above 50k',
  'I want to buy running shoes',
];

const ChatWindow = ({
  messages,
  input,
  setInput,
  onSend,
  isTyping,
  isPaying,
  paymentStatus,
  pendingOrder,
  onCheckout,
  chatError,
  onRestartChat,
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, pendingOrder]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="w-full max-w-2xl h-[78vh] flex flex-col rounded-3xl glass shadow-2xl shadow-brand-900/10 border border-white/60 overflow-hidden animate-fade-in">
      {/* Header strip */}
      <div className="px-6 py-4 bg-gradient-to-r from-brand-600 to-purple-600 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg">
          🤖
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">AgenticCart Assistant</p>
          {/* <p className="text-white/70 text-xs leading-tight">Powered by Groq · Agentic Commerce</p> */}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-white/90 text-xs bg-white/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse-slow" />
            Live
          </div>
          <button
            onClick={() => window.location.reload()}
            title="Clear chat and refresh"
            className="flex items-center gap-1 text-white/90 text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 bg-gradient-to-b from-transparent to-white/30">
        {messages.map((m, idx) => (
          <ChatBubble key={idx} role={m.role} content={m.content} />
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-sm shadow-md">
                🤖
              </div>
              <TypingIndicator />
            </div>
          </div>
        )}

        {pendingOrder && (
          <OrderCard order={pendingOrder} onCheckout={onCheckout} isPaying={isPaying} paymentStatus={paymentStatus} />
        )}

        {messages.length <= 1 && !isTyping && (
          <div className="flex flex-wrap gap-2 ml-10 mt-2">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSend(s)}
                className="text-xs font-medium px-3 py-2 rounded-full bg-white/70 border border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {chatError && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <span className="text-xs text-red-600 font-medium">Chat hit a snag — you can keep trying or start fresh.</span>
            <button
              onClick={onRestartChat}
              className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
            >
              Restart Chat
            </button>
          </div>
        </div>
      )}
      {/* Input bar */}
      <div className="px-4 py-4 bg-white/70 border-t border-gray-100 backdrop-blur-md">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AgenticCart to find or buy something…"
            className="flex-1 resize-none max-h-28 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent shadow-sm"
          />
          <button
            onClick={() => onSend()}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-brand-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          AgenticCart can search products, build orders, and checkout via Razorpay — all in chat.
        </p>
      </div>
    </div>
  );
};

export default ChatWindow;