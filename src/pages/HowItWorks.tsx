import { Card, CardContent } from "@/components/ui/card";
import { 
  Wallet, 
  TrendingUp, 
  Beer, 
  FileText, 
  CheckCircle2, 
  LifeBuoy,
  DollarSign
} from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";

const HowItWorks = () => {

  const tabs = [
    {
      name: "Bank",
      icon: Wallet,
      description: "View all your accounts in one place",
      details: "See your checking, savings, credit cards, and other accounts at a glance. Track your balances and understand your true financial position.",
      features: [
        "Multiple account types supported",
        "Real-time balance tracking",
        "Credit and debit account management",
      ],
    },
    {
      name: "Income",
      icon: TrendingUp,
      description: "Track your paychecks and income sources",
      details: "Know exactly when your next paycheck arrives. Calculate your coasting days and plan your spending accordingly.",
      features: [
        "Schedule recurring income",
        "Track multiple income sources",
        "Calculate days until next paycheck",
      ],
    },
    {
      name: "Coaster",
      icon: Beer,
      description: "Daily spending tracker",
      details: "Track your daily expenses just like items on a bar tab. See what you've spent and what's coming up.",
      features: [
        "Add expenses as you go",
        "Track past and future expenses",
        "Visual spending overview",
      ],
    },
    {
      name: "Bills",
      icon: FileText,
      description: "Manage your recurring payments",
      details: "Never miss a bill payment. Track scheduled and autopay bills, see what's due this month and next.",
      features: [
        "Schedule recurring bills",
        "Track autopay subscriptions",
        "Categorize by type (Rent, Need, Want, etc.)",
      ],
    },
    {
      name: "Real Bank",
      icon: DollarSign,
      description: "Your true available balance",
      details: "See your real spending power after accounting for all accounts, credit, and expenses.",
      features: [
        "Calculate actual available funds",
        "Account for all expenses",
        "Understand true financial position",
      ],
    },
    {
      name: "Abek",
      icon: LifeBuoy,
      description: "Master your money",
      details: "Your financial lifeline. Get insights, summaries, and a complete view of your financial health.",
      features: [
        "Complete financial overview",
        "Survivor mode calculations",
        "Monthly summaries and insights",
      ],
    },
  ];

  const steps = [
    {
      step: "1",
      title: "Sign Up",
      description: "Create your free Abek account in seconds. No credit card required to start.",
    },
    {
      step: "2",
      title: "Add Your Accounts",
      description: "Connect your bank accounts, credit cards, and other financial accounts.",
    },
    {
      step: "3",
      title: "Set Up Your Income",
      description: "Add your income sources and pay schedules so Abek knows when money is coming in.",
    },
    {
      step: "4",
      title: "Track Your Spending",
      description: "Use the Coaster tab to track expenses and the Bills tab to manage recurring payments.",
    },
    {
      step: "5",
      title: "Monitor Your Tab",
      description: "Check your Real Bank balance and Abek tab to see your true financial position anytime.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 md:px-8 pt-32">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground mb-6">
            How <span className="text-secondary">Abek</span> Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Managing your money is as simple as keeping track of your tab. Here's how it all comes together.
          </p>
        </div>
      </section>

      {/* Getting Started Steps */}
      <section className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Getting Started</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Set up your Abek account in just a few simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-5 gap-6">
            {steps.map((item, index) => (
              <Card 
                key={index}
                className="border-2 hover:shadow-card-hover transition-smooth hover:-translate-y-1"
              >
                <CardContent className="pt-8 pb-6 text-center space-y-4">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="absolute text-6xl font-bold text-secondary/10">
                      {item.step}
                    </div>
                    <div className="relative bg-secondary/20 p-4 rounded-2xl w-16 h-16 flex items-center justify-center">
                      <span className="text-2xl font-bold text-secondary relative z-10">{item.step}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs Explanation */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">The Six Tabs</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your finances, organized like a bar menu.
            </p>
          </div>
          <div className="space-y-8">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <Card 
                  key={index}
                  className="border-2 hover:shadow-card-hover transition-smooth"
                >
                  <CardContent className="pt-8 pb-8 px-8">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="flex-shrink-0">
                        <div className="bg-secondary/20 p-6 rounded-2xl inline-flex items-center justify-center">
                          <Icon className="w-12 h-12 text-secondary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-3xl font-bold text-foreground">{tab.name}</h3>
                        </div>
                        <p className="text-lg text-muted-foreground mb-4 font-medium">
                          {tab.description}
                        </p>
                        <p className="text-muted-foreground mb-4 leading-relaxed">
                          {tab.details}
                        </p>
                        <div className="space-y-2 mt-4">
                          {tab.features.map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Budgeting Features */}
      <section className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Key Budgeting Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              What makes Abek different from other budgeting tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardContent className="pt-6 pb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">Visual Tab System</h3>
                <p className="text-muted-foreground">
                  See all your financial information organized in easy-to-understand tabs, just like a bar menu. 
                  No complicated spreadsheets or confusing categories.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 pb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">Real-Time Balance</h3>
                <p className="text-muted-foreground">
                  Know your true available balance at any moment. Abek calculates your real spending power 
                  after accounting for all accounts, credit, and upcoming expenses.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 pb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">Coasting Days</h3>
                <p className="text-muted-foreground">
                  Calculate how many days you can "coast" until your next paycheck. This helps you plan your 
                  spending and avoid running out of money.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 pb-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">Bill Management</h3>
                <p className="text-muted-foreground">
                  Never miss a payment. Track all your bills, subscriptions, and recurring expenses in one place 
                  with automatic next-month calculations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;

