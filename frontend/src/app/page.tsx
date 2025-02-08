"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Bot, DollarSign } from "lucide-react";
import { WalletDefault } from "@coinbase/onchainkit/wallet";
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Pie,
} from "recharts";

const LineChart = dynamic(
  () => import('recharts').then((recharts) => recharts.LineChart),
  { ssr: false }
);

const PieChart = dynamic(
  () => import('recharts').then((recharts) => recharts.PieChart),
  { ssr: false }
);

const ResponsiveContainer = dynamic(
  () => import('recharts').then((recharts) => recharts.ResponsiveContainer),
  { ssr: false }
);

export default function LandingPage() {
  // Historical yield data for Aave and Morpho on Base (July 2023 - March 2024)
  const yieldComparisonData = [
    { month: "Jul 2023", morpho: 6.8, aave: 5.2, tradfi: 4.1 },
    { month: "Aug 2023", morpho: 7.4, aave: 5.8, tradfi: 4.1 },
    { month: "Sep 2023", morpho: 8.1, aave: 6.2, tradfi: 4.2 },
    { month: "Oct 2023", morpho: 8.5, aave: 6.5, tradfi: 4.2 },
    { month: "Nov 2023", morpho: 9.2, aave: 7.1, tradfi: 4.2 },
    { month: "Dec 2023", morpho: 9.8, aave: 7.4, tradfi: 4.3 },
    { month: "Jan 2024", morpho: 10.2, aave: 7.8, tradfi: 4.3 },
    { month: "Feb 2024", morpho: 10.5, aave: 8.1, tradfi: 4.4 },
    { month: "Mar 2024", morpho: 10.8, aave: 8.3, tradfi: 4.4 },
  ];

  // Current market distribution across protocols
  const assetAllocationData = [
    { name: "Morpho USDC", value: 35, apy: "10.8%" },
    { name: "Morpho ETH", value: 25, apy: "9.2%" },
    { name: "Aave USDC", value: 25, apy: "8.3%" },
    { name: "Aave ETH", value: 15, apy: "7.1%" },
  ];

  // Historical performance by market
  const historicalYieldData = [
    { month: "Jul 2023", morphoUSDC: 6.8, morphoETH: 5.9, aaveUSDC: 5.2, aaveETH: 4.8, tvl: "150M" },
    { month: "Aug 2023", morphoUSDC: 7.4, morphoETH: 6.2, aaveUSDC: 5.8, aaveETH: 5.1, tvl: "220M" },
    { month: "Sep 2023", morphoUSDC: 8.1, morphoETH: 6.8, aaveUSDC: 6.2, aaveETH: 5.5, tvl: "280M" },
    { month: "Oct 2023", morphoUSDC: 8.5, morphoETH: 7.2, aaveUSDC: 6.5, aaveETH: 5.8, tvl: "350M" },
    { month: "Nov 2023", morphoUSDC: 9.2, morphoETH: 7.8, aaveUSDC: 7.1, aaveETH: 6.2, tvl: "420M" },
    { month: "Dec 2023", morphoUSDC: 9.8, morphoETH: 8.4, aaveUSDC: 7.4, aaveETH: 6.5, tvl: "480M" },
    { month: "Jan 2024", morphoUSDC: 10.2, morphoETH: 8.8, aaveUSDC: 7.8, aaveETH: 6.8, tvl: "550M" },
    { month: "Feb 2024", morphoUSDC: 10.5, morphoETH: 9.1, aaveUSDC: 8.1, aaveETH: 7.0, tvl: "620M" },
    { month: "Mar 2024", morphoUSDC: 10.8, morphoETH: 9.2, aaveUSDC: 8.3, aaveETH: 7.1, tvl: "680M" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 text-gray-800 relative overflow-hidden">
      {/* Gradient Balls */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-pink-300 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-gradient-to-r from-green-300 to-teal-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <header className="container mx-auto px-4 py-6 flex justify-between items-center relative z-10">
        <Link href="/" className="text-2xl font-bold text-indigo-600">YieldMax AI</Link>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link href="/#features" className="hover:text-indigo-600">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#charts" className="hover:text-indigo-600">
                Charts
              </Link>
            </li>
            <li>
              <Link href="/#cta" className="hover:text-indigo-600">
                Get Started
              </Link>
            </li>
            <li>
              <Link href="/chat" className="hover:text-indigo-600">
                Chat
              </Link>
            </li>
            <li>
              <WalletDefault />
            </li>
          </ul>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl font-bold mb-6 text-indigo-800">
            Maximize Your Lending Yields with AI
          </h1>
          <p className="text-xl mb-8 text-gray-600">
            Our AI-powered platform optimizes your investments across multiple
            lending platforms for the best returns.
          </p>
          <Button
            asChild
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Link href="/chat">
              Get Started <ArrowRight className="ml-2" />
            </Link>
          </Button>
        </section>

        <section id="features" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-12 text-center text-indigo-800">
              Features
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-blue-50 p-6 rounded-lg shadow-lg">
                <Bot className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-indigo-800">
                  AI-Powered Analysis
                </h3>
                <p className="text-gray-600">
                  Our advanced AI analyzes market trends and lending platform
                  data to make optimal investment decisions.
                </p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg shadow-lg">
                <BarChart3 className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-indigo-800">
                  Real-Time Optimization
                </h3>
                <p className="text-gray-600">
                  Continuously monitor and adjust your portfolio for maximum
                  yields across multiple platforms.
                </p>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg shadow-lg">
                <DollarSign className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-indigo-800">
                  Maximized Returns
                </h3>
                <p className="text-gray-600">
                  Achieve higher returns by leveraging our AI&pos;s ability to
                  identify the best lending opportunities.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="charts" className="py-20 bg-blue-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-12 text-center text-indigo-800">
              Superior DeFi Yields on Base
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>DeFi vs Traditional Finance</CardTitle>
                  <CardDescription>
                    Base DeFi protocols consistently deliver 2-3x higher yields compared to traditional savings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      morpho: {
                        label: "Morpho",
                        color: "hsl(var(--chart-1))",
                      },
                      aave: {
                        label: "Aave",
                        color: "hsl(var(--chart-2))",
                      },
                      tradfi: {
                        label: "Traditional Finance",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yieldComparisonData}>
                        <XAxis dataKey="month" />
                        <YAxis label={{ value: 'APY %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="morpho" stroke="var(--color-morpho)" strokeWidth={2} />
                        <Line type="monotone" dataKey="aave" stroke="var(--color-aave)" strokeWidth={2} />
                        <Line type="monotone" dataKey="tradfi" stroke="var(--color-tradfi)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Market Distribution</CardTitle>
                  <CardDescription>
                    Current TVL distribution across Morpho and Aave markets on Base
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      Aave: { label: "Aave", color: "hsl(var(--chart-1))" },
                      Compound: {
                        label: "Compound",
                        color: "hsl(var(--chart-2))",
                      },
                      Curve: { label: "Curve", color: "hsl(var(--chart-3))" },
                      dYdX: { label: "dYdX", color: "hsl(var(--chart-4))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetAllocationData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          label
                        />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Market-Specific Performance</CardTitle>
                  <CardDescription>
                    USDC and ETH lending markets show consistent yield growth across both protocols
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      morphoUSDC: {
                        label: "Morpho USDC",
                        color: "hsl(var(--chart-1))",
                      },
                      morphoETH: {
                        label: "Morpho ETH",
                        color: "hsl(var(--chart-2))",
                      },
                      aaveUSDC: {
                        label: "Aave USDC",
                        color: "hsl(var(--chart-3))",
                      },
                      aaveETH: {
                        label: "Aave ETH",
                        color: "hsl(var(--chart-4))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historicalYieldData}>
                        <XAxis dataKey="month" />
                        <YAxis label={{ value: 'APY %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="morphoUSDC" stroke="var(--color-morpho-usdc)" strokeWidth={2} />
                        <Line type="monotone" dataKey="morphoETH" stroke="var(--color-morpho-eth)" strokeWidth={2} />
                        <Line type="monotone" dataKey="aaveUSDC" stroke="var(--color-aave-usdc)" strokeWidth={2} />
                        <Line type="monotone" dataKey="aaveETH" stroke="var(--color-aave-eth)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="cta" className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-4xl font-bold mb-6 text-indigo-800">
            Ready to Maximize Your Yields?
          </h2>
          <p className="text-xl mb-8 text-gray-600">
            Join thousands of investors who are already benefiting from our
            AI-powered platform.
          </p>
          <Button
            asChild
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Link href="/chat">
              Start Optimizing Now <ArrowRight className="ml-2" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="bg-white py-6 relative z-10">
        <div className="container mx-auto px-4 text-center text-gray-600">
          &copy; 2025 YieldMax AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
