import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Quote, Star, ArrowRight, ArrowLeft } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";

const Testimonials = () => {
  const navigate = useNavigate();

  // Placeholder testimonials - these can be replaced with real data from a CMS or database
  const testimonials = [
    {
      name: "Sarah M.",
      role: "Freelance Designer",
      content: "Abek has completely changed how I manage my money. The tab system makes so much sense—I can see everything at a glance and never feel overwhelmed. Finally, a budgeting app that actually works for me!",
      rating: 5,
      date: "January 2025",
    },
    {
      name: "James T.",
      role: "Recent Graduate",
      content: "As someone living paycheck to paycheck, Abek's coasting days feature is a lifesaver. I know exactly how long my money will last, and the bill tracker ensures I never miss a payment. Simple and effective.",
      rating: 5,
      date: "December 2024",
    },
    {
      name: "Maria L.",
      role: "Small Business Owner",
      content: "I've tried every budgeting app out there, and Abek is the first one that stuck. The visual approach and real bank balance feature give me confidence in my financial decisions. Highly recommend!",
      rating: 5,
      date: "January 2025",
    },
    {
      name: "David K.",
      role: "Parent of Two",
      content: "Managing finances for a family is stressful, but Abek makes it manageable. I can track all our accounts, bills, and expenses in one place. The interface is clean and intuitive—exactly what I needed.",
      rating: 5,
      date: "December 2024",
    },
    {
      name: "Emily R.",
      role: "Student",
      content: "As a student on a tight budget, Abek helps me see exactly where my money goes. The coaster tab is perfect for tracking daily expenses, and I love how simple everything is. No complicated features I'll never use.",
      rating: 5,
      date: "November 2024",
    },
    {
      name: "Michael P.",
      role: "Retail Worker",
      content: "Finally, a budgeting tool that doesn't make me feel bad about my finances. Abek shows me the reality of my situation and helps me plan better. The $1/month subscription is totally worth it.",
      rating: 5,
      date: "January 2025",
    },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${
          i < rating ? "text-secondary fill-secondary" : "text-muted-foreground/30"
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 md:px-8 pt-32">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground mb-6">
            What Our Users Say
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real stories from people who are mastering their money with Abek.
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index}
                className="border-2 hover:shadow-card-hover transition-smooth hover:-translate-y-1"
              >
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Quote className="w-8 h-8 text-secondary/30 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-3">
                        {renderStars(testimonial.rating)}
                      </div>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        "{testimonial.content}"
                      </p>
                      <div className="pt-4 border-t">
                        <p className="font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                        <p className="text-xs text-muted-foreground mt-1">{testimonial.date}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Share Your Story CTA */}
      <section className="py-20 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 bg-secondary/5">
            <CardContent className="pt-12 pb-12 px-8 text-center">
              <h2 className="text-3xl font-bold mb-4 text-foreground">Share Your Story</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Have a success story with Abek? We'd love to hear from you! Your experience can help others 
                on their financial journey.
              </p>
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => window.location.href = "mailto:hello@abek.com?subject=My Abek Story"}
              >
                Contact Us
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-8 bg-secondary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-4 text-foreground">Ready to Join Them?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your journey with Abek today and see why our users love it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate("/how-it-works")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Learn How It Works
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Testimonials;

