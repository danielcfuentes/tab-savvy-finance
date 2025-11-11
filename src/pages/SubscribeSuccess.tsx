import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";

const SubscribeSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const verifySubscription = async () => {
      if (!sessionId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No session ID found",
        });
        navigate("/subscribe");
        return;
      }

      // Wait a moment for webhook to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if subscription was created
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .single();

      if (subscription) {
        setLoading(false);
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate("/dashboard");
        }, 3000);
      } else {
        // Subscription not found yet, wait a bit more
        setTimeout(() => {
          verifySubscription();
        }, 2000);
      }
    };

    verifySubscription();
  }, [sessionId, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <WebsiteNav />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary mx-auto" />
            <p className="text-muted-foreground">Verifying your subscription...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      <section className="py-20 px-4 md:px-8 pt-32">
        <div className="container mx-auto max-w-2xl">
          <Card className="border-2 shadow-lg">
            <CardContent className="pt-12 pb-12 px-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/20 mb-6">
                <CheckCircle2 className="w-8 h-8 text-secondary" />
              </div>
              <h1 className="text-3xl font-bold mb-4 text-foreground">
                Subscription Activated!
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Thank you for subscribing to Abek! Your subscription is now active.
                Redirecting you to your dashboard...
              </p>
              <Button
                variant="hero"
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="text-lg"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default SubscribeSuccess;

