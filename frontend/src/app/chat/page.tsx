"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

export default function AppPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI assistant. How can I help you maximize your lending yields today?",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { role: "user", content: input }]);
      // Here you would typically send the message to your AI backend
      // and then add the AI's response to the messages
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm processing your request. This is a placeholder response.",
        },
      ]);
      setInput("");
    }
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
          <ul className="space-y-2">
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Dashboard
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Portfolio
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Analytics
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Settings
              </Button>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col bg-white">
        <header className="bg-indigo-100 p-4 border-b border-indigo-200">
          <h1 className="text-2xl font-bold text-indigo-800">
            YieldMax AI Assistant
          </h1>
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
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </ScrollArea>
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Ask about maximizing your yields..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <Button
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
