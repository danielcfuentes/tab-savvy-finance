import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Target, Eye, Heart, ArrowRight } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";

const About = () => {
  const navigate = useNavigate();

  const values = [
    {
      icon: Heart,
      title: "Simplicity",
      description: "We believe managing money should be straightforward and stress-free, not complicated.",
    },
    {
      icon: Eye,
      title: "Transparency",
      description: "See your true financial picture at a glance, without hidden fees or confusing terms.",
    },
    {
      icon: Target,
      title: "Empowerment",
      description: "Give you the tools and insights to take control of your financial future.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 md:px-8 pt-32">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground mb-6">
            About <span className="text-secondary">Abek</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We're on a mission to make personal finance accessible, understandable, and empowering for everyone.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2">
            <CardContent className="pt-12 pb-12 px-8 md:px-12">
              <h2 className="text-3xl font-bold mb-6 text-foreground">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Abek was born from a simple observation: managing money shouldn't feel like rocket science. 
                Just like keeping track of your tab at a bar, budgeting should be visual, intuitive, and 
                something you can understand at a glance.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We're committed to breaking down the barriers that make personal finance feel overwhelming. 
                Our goal is to provide you with a tool that helps you understand your money, plan for the future, 
                and feel confident in your financial decisions—all without the complexity of traditional 
                budgeting apps.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2">
            <CardContent className="pt-12 pb-12 px-8 md:px-12">
              <h2 className="text-3xl font-bold mb-6 text-foreground">Our Vision</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                We envision a world where everyone has the tools and confidence to manage their finances effectively. 
                Where budgeting isn't a chore, but a simple part of daily life—like checking your tab before 
                you leave the bar.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Abek aims to be the budgeting tool that grows with you. Whether you're living paycheck to paycheck, 
                saving for a goal, or planning for the future, we want to be there every step of the way, making 
                financial management as natural as breathing.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Our Values</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we do.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card 
                  key={index} 
                  className="border-2 hover:shadow-card-hover transition-smooth hover:-translate-y-1"
                >
                  <CardContent className="pt-8 pb-6 text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center">
                      <div className="relative bg-secondary/20 p-4 rounded-2xl">
                        <Icon className="w-8 h-8 text-secondary" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">{value.title}</h3>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-foreground">The Story Behind Abek</h2>
          </div>
          <Card className="border-2">
            <CardContent className="pt-12 pb-12 px-8 md:px-12">
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Abek started with a simple question: Why is budgeting so complicated? We noticed that most 
                people struggle with traditional budgeting methods because they're either too rigid, too complex, 
                or don't reflect how people actually think about money.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                The bar tab metaphor came naturally—it's something everyone understands. You keep track of what 
                you've spent, you know what's coming, and you can see your total at any moment. That's exactly 
                how budgeting should work.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Today, Abek is more than just a budgeting tool. It's a platform designed to help you build 
                better financial habits, understand your spending patterns, and feel in control of your money. 
                We're constantly evolving based on user feedback, always with the goal of making personal finance 
                simpler and more accessible.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-8 bg-secondary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-4 text-foreground">Join Us on This Journey</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Ready to experience budgeting the Abek way? Start your journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate("/how-it-works")}
            >
              Learn How It Works
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;

