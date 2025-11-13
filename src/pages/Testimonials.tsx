import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Quote, Star, ArrowRight } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Testimonial = Tables<"testimonials">;

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const { data, error } = await supabase
          .from("testimonials")
          .select("*")
          .order("created_at", { ascending: false });

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
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading testimonials...</p>
            </div>
          ) : testimonials.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No testimonials available yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
              <Card 
                key={testimonial.id}
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
          )}
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
    </div>
  );
};

export default Testimonials;

