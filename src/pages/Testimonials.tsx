import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Quote, Star, ArrowRight } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Testimonial = Tables<"testimonials">;

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    content: "",
    rating: 5,
  });

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

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Automatically set the date to current month and year
      const currentDate = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const { error } = await supabase
        .from("testimonials")
        .insert([
          {
            name: formData.name,
            role: formData.role,
            content: formData.content,
            rating: formData.rating,
            date: currentDate,
          },
        ]);

      if (error) {
        throw error;
      }

      // Reset form
      setFormData({
        name: "",
        role: "",
        content: "",
        rating: 5,
      });

      setSubmitSuccess(true);
      setShowForm(false); // Collapse form after successful submission
      
      // Refresh testimonials
      await fetchTestimonials();

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (error: any) {
      console.error("Error submitting testimonial:", error);
      setSubmitError(error.message || "Failed to submit testimonial. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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

              {!showForm ? (
                <Button 
                  variant="hero" 
                  size="lg"
                  onClick={() => setShowForm(true)}
                >
                  Share Your Story
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <div className="max-w-2xl mx-auto">
                  {submitSuccess && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-md text-center">
                      <p className="text-green-600 dark:text-green-400 font-medium">
                        Thank you! Your testimonial has been submitted and will be reviewed.
                      </p>
                    </div>
                  )}

                  {submitError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-md text-center">
                      <p className="text-red-600 dark:text-red-400 font-medium">{submitError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6 text-left">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          type="text"
                          placeholder="Your name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role/Title *</Label>
                        <Input
                          id="role"
                          type="text"
                          placeholder="e.g., Freelance Designer, Student"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">Your Story *</Label>
                      <Textarea
                        id="content"
                        placeholder="Share your experience with Abek..."
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        required
                        rows={5}
                        className="resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rating">Rating *</Label>
                      <Select
                        value={formData.rating.toString()}
                        onValueChange={(value) => setFormData({ ...formData, rating: parseInt(value) })}
                      >
                        <SelectTrigger id="rating">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Stars ⭐⭐⭐⭐⭐</SelectItem>
                          <SelectItem value="4">4 Stars ⭐⭐⭐⭐</SelectItem>
                          <SelectItem value="3">3 Stars ⭐⭐⭐</SelectItem>
                          <SelectItem value="2">2 Stars ⭐⭐</SelectItem>
                          <SelectItem value="1">1 Star ⭐</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="lg"
                        onClick={() => {
                          setShowForm(false);
                          setSubmitError(null);
                          setSubmitSuccess(false);
                        }}
                        disabled={submitting}
                        className="w-full sm:w-auto sm:flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        variant="hero" 
                        size="lg"
                        disabled={submitting}
                        className="w-full sm:w-auto sm:flex-1"
                      >
                        {submitting ? (
                          "Submitting..."
                        ) : (
                          <>
                            Submit Testimonial
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Testimonials;

