"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import Link from "next/link";

// API configuration
const API_URL = "https://autonome.alt.technology/yieldmax-tlxdlx";
const API_HEADERS = {
  'Authorization': 'Basic eWllbGRtYXg6SVFTb1JabU16Sg==',
  'Content-Type': 'application/json'
};

interface Message {
  role: "assistant" | "user";
  content: string;
  loading?: boolean;
  error?: boolean;
}

export default function AppPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you maximize your lending yields today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isLoading) {
      try {
        setIsLoading(true);
        const userMessage: Message = { role: "user", content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");

        const response = await fetch(`${API_URL}/message`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify({ message: input }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response from agent');
        }

        const data = await response.json();
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.text,
        }]);

      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          error: true
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you maximize your lending yields today?",
    }]);
  };

  const setExamplePrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800">
      <aside className="w-64 bg-white p-4 border-r border-gray-200">
        <Link
          href="/"
          className="flex items-center mb-6 text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="mr-2" /> Back to Home
        </Link>
        <nav>
          <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">AI Yield Assistant</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ask me about market analysis, lending strategies, and yield optimization.
            </p>
            <h4 className="text-sm font-semibold mb-2">Example Commands</h4>
            <div className="space-y-2">
              <button 
                onClick={() => setExamplePrompt("Analyze all lending markets on Base")}
                className="text-sm text-left text-indigo-600 hover:text-indigo-800 block"
              >
                • Analyze all markets
              </button>
              <button 
                onClick={() => setExamplePrompt("Compare Morpho and Aave USDC markets")}
                className="text-sm text-left text-indigo-600 hover:text-indigo-800 block"
              >
                • Compare protocols
              </button>
              <button 
                onClick={() => setExamplePrompt("What's the optimal lending strategy for 1000 USDC?")}
                className="text-sm text-left text-indigo-600 hover:text-indigo-800 block"
              >
                • Get strategy advice
              </button>
            </div>
          </div>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col bg-white">
        <header className="bg-indigo-100 p-4 border-b border-indigo-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-800">
            YieldMax AI Assistant
          </h1>
          <Button
            onClick={clearChat}
            variant="ghost"
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </header>
        <ScrollArea className="flex-1 p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : message.error
                      ? "bg-red-100 text-red-800 border border-red-300"
                      : "bg-gray-200 text-gray-800"
                } max-w-[80%] whitespace-pre-wrap`}
              >
                {message.content}
                {message.loading && (
                  <div className="flex items-center mt-2">
                    <div className="animate-pulse">Analyzing markets...</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Ask about maximizing your yields..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}