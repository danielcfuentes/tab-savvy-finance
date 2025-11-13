import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { 
  Wallet, 
  TrendingUp, 
  Receipt, 
  ArrowRight, 
  CheckCircle2, 
  Shield, 
  DollarSign,
  Clock,
  Users,
  Star,
  Beer,
  FileText,
  LifeBuoy
} from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.png";
import WebsiteNav from "@/components/WebsiteNav";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Testimonial = Tables<"testimonials">;

const Landing = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        // Fetch only the first 3 testimonials for the landing page
        const { data, error } = await supabase
          .from("testimonials")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3);

        if (error) {
          console.error("Error fetching testimonials:", error);
        } else {
          setTestimonials(data || []);
        }
      } catch (error) {
        console.error("Error fetching testimonials:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, []);

  const features = [
    {
      icon: Wallet,
      title: "All Accounts, One View",
      description: "Connect checking, savings, credit cards, and more. See your complete financial picture instantly.",
      step: "1",
      color: "from-blue-500/20 to-blue-600/20",
    },
    {
      icon: TrendingUp,
      title: "Smart Income Tracking",
      description: "Know exactly when money arrives. Calculate coasting days and plan your spending with confidence.",
      step: "2",
      color: "from-green-500/20 to-green-600/20",
    },
    {
      icon: Receipt,
      title: "Never Miss a Bill",
      description: "Track all recurring payments, subscriptions, and bills. Automatic next-month calculations included.",
      step: "3",
      color: "from-purple-500/20 to-purple-600/20",
    },
  ];

  const tabs = [
    { name: "Bank", icon: Wallet, desc: "View all your accounts", color: "bg-blue-500/10" },
    { name: "Income", icon: TrendingUp, desc: "Track paychecks", color: "bg-green-500/10" },
    { name: "Coaster", icon: Beer, desc: "Daily spending tracker", color: "bg-amber-500/10" },
    { name: "Bills", icon: FileText, desc: "Manage payments", color: "bg-purple-500/10" },
    { name: "Real Bank", icon: DollarSign, desc: "Your true available balance", color: "bg-emerald-500/10" },
    { name: "Abek", icon: LifeBuoy, desc: "Master your money", color: "bg-secondary/20" },
  ];

  const benefits = [
    "Simple, visual budgeting",
    "Track spending in real-time",
    "Never miss a bill payment",
    "Understand your true financial picture",
  ];



  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 md:px-8 pt-32">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-foreground">
                <span className="text-secondary relative">
                  Abek{" "}
                  <span className="absolute -bottom-2 left-0 right-0 h-3 bg-secondary/20 -z-10 transform -skew-x-12" />
                </span>
                Budgeting Made{" "}
                <span className="text-secondary relative">
                  Simple
                  <span className="absolute -bottom-2 left-0 right-0 h-3 bg-secondary/20 -z-10 transform -skew-x-12" />
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
                Manage your money like a bar tab—visual, intuitive, and always clear.{" "}
                <span className="font-semibold text-foreground">No spreadsheets. No confusion. Just clarity.</span>
              </p>
              <div className="space-y-3 py-2">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-secondary" />
                    </div>
                    <span className="text-foreground font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={() => navigate("/subscribe")}
                  className="text-lg group shadow-lg hover:shadow-xl"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate("/how-it-works")}
                  className="border-2"
                >
                  See How It Works
                </Button>
              </div>
            </div>
            <div className="relative animate-float">
              <div className="absolute -inset-4 bg-gradient-to-r from-secondary/20 to-secondary/10 rounded-3xl blur-2xl opacity-50" />
              <img 
                src={heroIllustration} 
                alt="Abek budgeting app illustration" 
                className="w-full rounded-2xl shadow-card-hover relative z-10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Abek Section */}
      <section className="py-20 px-4 md:px-8 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Why Choose <span className="text-secondary">Abek</span>?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Budgeting shouldn't feel like work. We've built the simplest, most intuitive way to manage your money.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="border-2 hover:shadow-card-hover transition-smooth hover:-translate-y-2 group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="pt-8 pb-8 text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center mb-4">
                      <div className="absolute text-7xl font-bold text-secondary/5 group-hover:text-secondary/10 transition-colors">
                        {feature.step}
                      </div>
                      <div className={`relative bg-gradient-to-br ${feature.color} p-5 rounded-2xl group-hover:scale-110 transition-transform`}>
                        <Icon className="w-10 h-10 text-secondary" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
        </div>
      </section>

      {/* Feature Tabs Preview */}
      <section className="py-20 px-4 md:px-8 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Everything You Need in <span className="text-secondary">Six Tabs</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your complete financial toolkit, organized like a bar menu. Simple, visual, and always accessible.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <Card 
                  key={index}
                  className="hover:shadow-card-hover transition-smooth cursor-pointer hover:-translate-y-2 group border-2"
                >
                  <CardContent className="pt-8 pb-8 text-center space-y-4">
                    <div className="flex justify-center mb-2">
                      <div className={`bg-secondary/20 p-4 rounded-2xl group-hover:scale-110 transition-transform ${tab.color}`}>
                        <Icon className="w-8 h-8 text-secondary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{tab.name}</h3>
                    <p className="text-sm text-muted-foreground">{tab.desc}</p>
                    <div className={`h-1 w-0 group-hover:w-full transition-all duration-300 ${tab.color} rounded-full mx-auto`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="text-center">
            <Button 
              variant="hero" 
              size="lg"
              onClick={() => navigate("/how-it-works")}
              className="shadow-lg"
            >
              Explore All Features
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 md:px-8 bg-muted/20">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2 text-foreground">Loved by Budgeters Everywhere</h2>
            <p className="text-muted-foreground">Join thousands who've simplified their finances with Abek</p>
          </div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading testimonials...</p>
            </div>
          ) : testimonials.length > 0 ? (
            <>
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {testimonials.map((testimonial, index) => (
                  <Card key={testimonial.id || index} className="border-2 bg-card">
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${
                              i < testimonial.rating 
                                ? "fill-secondary text-secondary" 
                                : "text-muted-foreground/30"
                            }`} 
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground mb-4 italic">
                        "{testimonial.content}"
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                          <Users className="w-4 h-4 text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="text-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate("/testimonials")}
                >
                  Read More Stories
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No testimonials available yet.</p>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/testimonials")}
              >
                View Testimonials
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Highlight */}
      <section className="py-16 px-4 md:px-8 bg-gradient-to-r from-secondary/10 via-secondary/5 to-secondary/10">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 border-secondary/20 shadow-lg">
            <CardContent className="pt-12 pb-12 px-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 mb-6">
                <DollarSign className="w-4 h-4 text-secondary" />
                <span className="text-sm font-semibold text-foreground">Simple Pricing</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                Just <span className="text-secondary">$1/month</span>. That's it.
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                No hidden fees. Cancel anytime. Simple, transparent pricing.
              </p>
              <div className="flex justify-center">
                <Button 
                  variant="hero" 
                  size="lg"
                  onClick={() => navigate("/subscribe")}
                  className="text-lg shadow-lg"
                >
                  Subscribe Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-8 border-t">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Abek</h3>
              <p className="text-muted-foreground text-sm">Master your money, one tab at a time.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Product</h4>
              <div className="space-y-2 text-sm">
                <Link to="/how-it-works" className="block text-muted-foreground hover:text-foreground transition-smooth">
                  How It Works
                </Link>
                <Link to="/about" className="block text-muted-foreground hover:text-foreground transition-smooth">
                  About
                </Link>
                <button 
                  onClick={() => navigate("/auth")}
                  className="block text-muted-foreground hover:text-foreground transition-smooth text-left"
                >
                  Web App
                </button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Resources</h4>
              <div className="space-y-2 text-sm">
                <Link to="/testimonials" className="block text-muted-foreground hover:text-foreground transition-smooth">
                  Testimonials
                </Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Account</h4>
              <div className="space-y-2 text-sm">
                <button 
                  onClick={() => navigate("/auth")}
                  className="block text-muted-foreground hover:text-foreground transition-smooth text-left"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => navigate("/subscribe")}
                  className="block text-muted-foreground hover:text-foreground transition-smooth text-left"
                >
                  Get Started
                </button>
                <button 
                  onClick={() => navigate("/subscribe")}
                  className="block text-muted-foreground hover:text-foreground transition-smooth text-left"
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
          <div className="text-center pt-8 border-t text-sm text-muted-foreground">
            © 2025 Abek. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
