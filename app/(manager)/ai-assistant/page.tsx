// app/(manager)/ai-assistant/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { aiClient } from "@/lib/ai-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, User, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Message = { 
  id: string; 
  role: "user" | "ai"; 
  text: string; 
  timestamp?: Date;
};

const STORAGE_KEY = "erp:chat";

export default function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch {}
    }
    // Welcome message
    setMessages([{
      id: "welcome",
      role: "ai",
      text: "👋 Hello! I'm your AI business assistant. I can help with:\n• Products & Inventory\n• Customers & Orders\n• Sales & Revenue\n• Employees & Teams\n• Business hours\n• Contact information\n\nTry asking me something!"
    }]);
  }, []);

  // Check AI service health
  useEffect(() => {
    const checkService = async () => {
      const health = await aiClient.healthCheck();
      setIsServiceReady(health.status === 'healthy');
    };
    checkService();
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      let reply: string;
      
      if (isServiceReady) {
        // Use Python AI service
        const result = await aiClient.sendMessage(text, user?.id || "guest", user?.email || "guest@guest.com");
        // Ensure we have a string reply
        reply = result.reply || result.error || "Sorry, I couldn't process your request. Please try again.";
      } else {
        // Fallback: use simple response
        reply = fallbackResponse(text);
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: reply,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      toast.error("Failed to get AI response");
      // Add error message to chat
      const errorMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: "Sorry, I encountered an error. Please try again later.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const fallbackResponse = (message: string): string => {
    const text = message.toLowerCase();
    if (text.includes("hello") || text.includes("hi")) {
      return "Hello! 👋 How can I help with your business today?";
    }
    if (text.includes("help")) {
      return "I can help with products, customers, sales, employees, and more!";
    }
    if (text.includes("product") || text.includes("inventory")) {
      return "📦 Check the Products section to manage your inventory.";
    }
    if (text.includes("customer")) {
      return "👥 Customer management is in the Customers section.";
    }
    if (text.includes("revenue") || text.includes("sales")) {
      return "💰 You can view sales and revenue in the Dashboard or Sales sections.";
    }
    if (text.includes("employee") || text.includes("team")) {
      return "👨‍💼 Employee management is available in the Employees section.";
    }
    return "I'm your AI assistant. I'm currently in fallback mode. Please try asking about products, customers, or sales.";
  };

  const suggestions = [
    "How many products do I have?",
    "Tell me about customers",
    "What's the revenue?",
    "Help",
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="AI Assistant" 
        description="Chat with your business — powered by AI."
        action={
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isServiceReady ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {isServiceReady ? 'AI Ready' : 'Fallback Mode'}
            </span>
          </div>
        }
      />
      <Card className="flex h-[70vh] flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-foreground"
                }`}>
                  {m.text}
                </div>
                {m.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-2 px-4 sm:px-6 pb-2">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          <div className="border-t p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything about your business…"
                rows={1}
                className="min-h-11 resize-none"
                disabled={isProcessing}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}