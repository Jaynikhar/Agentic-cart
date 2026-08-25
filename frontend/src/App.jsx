import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatWindow from './components/chatWindow';
import { sendChatMessage, createRazorpayOrder, verifyRazorpayPayment } from './api';

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

const genSessionId = () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi! I'm your AgenticCart shopping assistant 🛍️ Tell me what you're looking for — I can search products, compare options, and check you out right here in chat.",
    },
  ]);
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'success' | 'failed'
  const [pendingOrder, setPendingOrder] = useState(null);
  const sessionIdRef = useRef(genSessionId());

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handleRestartChat = () => {
    sessionIdRef.current = genSessionId();
    setMessages([
      {
        role: 'assistant',
        content: "Chat restarted! I'm your AgenticCart shopping assistant 🛍️ What are you looking for?",
      },
    ]);
    setPendingOrder(null);
    setPaymentStatus(null);
    setChatError(false);
    setInput('');
  };

  const buildHistoryPayload = useCallback(
    (msgs) =>
      msgs
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content })),
    []
  );



  const handleCheckout = async (order) => {
    setIsPaying(true);
    setPaymentStatus(null);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay checkout script.');
      }

      const { razorpayOrder, keyId, internalOrderId } = await createRazorpayOrder({
        internalOrderId: order.internalOrderId,
        amount: order.totalAmount,
        currency: order.currency || 'INR',
        receipt: `receipt_${order.internalOrderId}`,
      });

      const options = {
        key: keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'AgenticCart',
        description: `Order #${internalOrderId?.slice(-6) || ''}`,
        order_id: razorpayOrder.id,
        theme: { color: '#4f46e5' },
        prefill: {},
        handler: async function (response) {
          try {
            const verifyRes = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              internalOrderId,
            });

            if (verifyRes.success) {
              setPaymentStatus('success');
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `✅ Payment verified! Your order (#${internalOrderId.slice(-6)}) is confirmed. Thank you for shopping with AgenticCart!`,
                },
              ]);
            } else {
              setPaymentStatus('failed');
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: '⚠️ Payment verification failed. Please try again or contact support.' },
              ]);
            }
          } catch (err) {
            setPaymentStatus('failed');
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: '⚠️ Something went wrong verifying your payment.' },
            ]);
          } finally {
            setPendingOrder(null);
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsPaying(false);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: 'No worries — checkout was cancelled. Let me know if you want to resume.' },
            ]);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function () {
        setPaymentStatus('failed');
        setIsPaying(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '❌ Payment failed. You can try again whenever you’re ready.' },
        ]);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      setIsPaying(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Couldn't start checkout: ${err.message}` },
      ]);
    }
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isTyping) return;

    const userMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    try {
      const data = await sendChatMessage({
        message: text,
        sessionId: sessionIdRef.current,
        history: buildHistoryPayload(messages),
      });

      const assistantMessage = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.orderCreated && data.orderCreated.orderCreated) {
        setPendingOrder(data.orderCreated);
      }
    } catch (err) {
      console.error(err);
      setChatError(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Hmm, something went wrong processing that message. You can try again, or restart the chat if it keeps happening.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-brand-300/30 rounded-full blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full px-6 py-5 flex items-center justify-between glass sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-brand-500/30">
              🛒
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">AgenticCart</h1>
              {/* <p className="text-xs text-gray-500 -mt-0.5">AI Agentic Commerce · Razorpay Buildathon</p> */}
              <ul className="text-xs text-gray-500 -mt-0.5 space-y-1">
                <li>Book products with AI assistance</li>
                <li>Pay securely with Razorpay</li>
              </ul>

            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-500 bg-white/60 px-3 py-1.5 rounded-full border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" />
            Agent Online
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <ChatWindow
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isTyping={isTyping}
            isPaying={isPaying}
            paymentStatus={paymentStatus}
            pendingOrder={pendingOrder}
            onCheckout={handleCheckout}
            chatError={chatError}
            onRestartChat={handleRestartChat}
          />
        </main>

        <footer className="w-full py-4 text-center text-xs text-gray-400">
          @-copyright 2024 AgenticCart. All rights reserved. 
        </footer>
      </div>
    </div>
  );
}

export default App;