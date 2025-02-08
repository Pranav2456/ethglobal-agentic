import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Bot, DollarSign } from "lucide-react";
import { WalletDefault } from "@coinbase/onchainkit/wallet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function LandingPage() {
  // Sample data for charts
  const yieldComparisonData = [
    { month: "Jan", withAI: 5.2, withoutAI: 3.8 },
    { month: "Feb", withAI: 5.5, withoutAI: 3.9 },
    { month: "Mar", withAI: 5.8, withoutAI: 4.0 },
    { month: "Apr", withAI: 6.0, withoutAI: 4.1 },
    { month: "May", withAI: 6.2, withoutAI: 4.0 },
    { month: "Jun", withAI: 6.5, withoutAI: 4.2 },
  ];

  const assetAllocationData = [
    { name: "Aave", value: 35 },
    { name: "Compound", value: 30 },
    { name: "Curve", value: 20 },
    { name: "dYdX", value: 15 },
  ];

  const historicalYieldData = [
    { month: "Jul", yield: 5.8 },
    { month: "Aug", yield: 6.0 },
    { month: "Sep", yield: 6.2 },
    { month: "Oct", yield: 6.5 },
    { month: "Nov", yield: 6.7 },
    { month: "Dec", yield: 7.0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 text-gray-800 relative overflow-hidden">
      {/* Gradient Balls */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-pink-300 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-gradient-to-r from-green-300 to-teal-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <header className="container mx-auto px-4 py-6 flex justify-between items-center relative z-10">
        <div className="text-2xl font-bold text-indigo-600">YieldMax AI</div>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link href="#features" className="hover:text-indigo-600">
                Features
              </Link>
            </li>
            <li>
              <Link href="#charts" className="hover:text-indigo-600">
                Charts
              </Link>
            </li>
            <li>
              <Link href="#cta" className="hover:text-indigo-600">
                Get Started
              </Link>
            </li>
            <li>
              <Link href="/app" className="hover:text-indigo-600">
                App
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
            <Link href="/app">
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
              How AI Maximizes Your Yields
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Yield Comparison: AI vs. Traditional</CardTitle>
                  <CardDescription>
                    See how our AI outperforms traditional methods
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      withAI: {
                        label: "With AI",
                        color: "hsl(var(--chart-1))",
                      },
                      withoutAI: {
                        label: "Without AI",
                        color: "hsl(var(--chart-2))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yieldComparisonData}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="withAI" fill="var(--color-withAI)" />
                        <Bar
                          dataKey="withoutAI"
                          fill="var(--color-withoutAI)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Optimized Asset Allocation</CardTitle>
                  <CardDescription>
                    How our AI diversifies your assets for maximum returns
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
                  <CardTitle>Historical Yield Performance</CardTitle>
                  <CardDescription>
                    Track the growth of your investments over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      yield: { label: "Yield", color: "hsl(var(--chart-1))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historicalYieldData}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="yield"
                          stroke="var(--color-yield)"
                          strokeWidth={2}
                        />
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
            <Link href="/app">
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
