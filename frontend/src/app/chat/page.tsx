"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Wallet } from "lucide-react";
import Link from "next/link";
import { 
  ConnectWallet, 
  Wallet as WalletComponent, 
  WalletDropdown, 
  WalletDropdownDisconnect 
} from '@coinbase/onchainkit/wallet';
import { 
  Address, 
  Avatar, 
  Name, 
  Identity 
} from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import { parseUnits } from "viem";
import { useSendTransaction } from 'wagmi';
import { color } from '@coinbase/onchainkit/theme';

// Define API URL - You can set this in your .env.local
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: "assistant" | "user";
  content: string;
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
  const [fundAmount, setFundAmount] = useState("");

  const { address } = useAccount();
  const { sendTransaction } = useSendTransaction();

  const getAgentWallet = async () => {
    try {
      const response = await fetch(`${API_URL}/agent-address`);
      if (!response.ok) throw new Error('Failed to get agent address');
      const data = await response.json();
      return data.address as `0x${string}`;
    } catch (error) {
      console.error('Error getting agent address:', error);
      throw error;
    }
  };

  const handleFund = async () => {
    try {
      if (!address) {
        alert("Please connect your wallet first");
        return;
      }

      const agentAddress = await getAgentWallet();
      const amount = parseUnits(fundAmount, 18);

      const hash = await sendTransaction({
        to: agentAddress,
        value: amount,
      });

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Transaction sent! Hash: ${hash}\nThank you for funding the agent with ${fundAmount} ETH!`
      }]);

      setFundAmount("");
    } catch (error) {
      console.error('Funding error:', error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, there was an error processing your transaction."
      }]);
    }
  };

  const handleSend = async () => {
    if (input.trim() && !isLoading) {
      try {
        setIsLoading(true);
        const userMessage: Message = { role: "user" as const, content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");

        const response = await fetch(`${API_URL}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
            <h3 className="text-sm font-semibold mb-2">Fund Agent Wallet</h3>
            <WalletComponent>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address className={color.foregroundMuted} />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </WalletComponent>
            {address && (
              <div className="mt-2">
                <Input
                  type="number"
                  placeholder="Amount in ETH"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="mb-2"
                />
                <Button 
                  onClick={handleFund}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Fund Agent
                </Button>
              </div>
            )}
          </div>
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
                } max-w-[80%] whitespace-pre-wrap`}
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