import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, Receipt } from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Wallet,
      title: "Add Bank Accounts",
      description: "Connect all your accounts in one place. See your real balance at a glance.",
      step: "1",
    },
    {
      icon: TrendingUp,
      title: "Track Paychecks",
      description: "Know exactly when your next income arrives. Calculate your coasting days.",
      step: "2",
    },
    {
      icon: Receipt,
      title: "Plan Your Bills",
      description: "Never miss a payment. Track expenses and survive paycheck to paycheck.",
      step: "3",
    },
  ];

  const tabs = [
    { name: "Bank", icon: "🏦", desc: "View all your accounts" },
    { name: "Income", icon: "💵", desc: "Track paychecks" },
    { name: "Coaster", icon: "🍻", desc: "Daily spending tracker" },
    { name: "Bills", icon: "🧾", desc: "Manage payments" },
    { name: "Close Out", icon: "✅", desc: "Monthly summary" },
    { name: "Abek", icon: "🛟", desc: "Master your money" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground">
                Take Control of Your Money —{" "}
                <span className="text-secondary">One Tab at a Time</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                A daily budgeting tool built around the bar tab metaphor.{" "}
                <span className="font-semibold text-foreground">Simple. Visual. Personal.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="text-lg"
                >
                  Open Your Tab → Get Started
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Learn How It Works
                </Button>
              </div>
            </div>
            <div className="animate-float">
              <img 
                src={heroIllustration} 
                alt="Bar tab and credit card illustration" 
                className="w-full rounded-2xl shadow-card-hover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl font-bold mb-4 text-foreground">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Managing money doesn't have to be complicated. Just like keeping track of your tab at the bar.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="border-2 hover:shadow-card-hover transition-smooth hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="pt-8 pb-6 text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center">
                      <div className="absolute text-6xl font-bold text-secondary/10">
                        {feature.step}
                      </div>
                      <div className="relative bg-secondary/20 p-4 rounded-2xl">
                        <Icon className="w-8 h-8 text-secondary" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Tabs Preview */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Six Powerful Tabs</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your finances, organized like a bar menu.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tabs.map((tab, index) => (
              <Card 
                key={index}
                className="hover:shadow-card-hover transition-smooth cursor-pointer hover:-translate-y-1"
              >
                <CardContent className="pt-6 pb-6 text-center space-y-3">
                  <div className="text-4xl">{tab.icon}</div>
                  <h3 className="text-xl font-semibold text-foreground">{tab.name}</h3>
                  <p className="text-sm text-muted-foreground">{tab.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-8 border-t">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-foreground mb-2">My Budget Bar</h3>
              <p className="text-muted-foreground">Take control, one tab at a time.</p>
            </div>
            <div className="flex gap-6 text-sm">
              <button className="text-muted-foreground hover:text-foreground transition-smooth">
                About
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-smooth">
                Contact
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-smooth">
                Privacy
              </button>
              <button 
                className="text-muted-foreground hover:text-foreground transition-smooth"
                onClick={() => navigate("/auth")}
              >
                Login
              </button>
            </div>
          </div>
          <div className="text-center mt-8 text-sm text-muted-foreground">
            © 2025 My Budget Bar. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
