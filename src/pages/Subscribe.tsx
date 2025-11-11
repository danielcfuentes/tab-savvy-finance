import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, DollarSign, ArrowRight } from "lucide-react";
import WebsiteNav from "@/components/WebsiteNav";

const Subscribe = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const checkSubscription = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    setIsLoggedIn(!!session);
    
    // If user is logged in, check subscription status
    if (session) {
      // Check if user already has an active subscription
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine
        console.error("Error checking subscription:", error);
      }

      if (subscription && new Date(subscription.current_period_end) > new Date()) {
        setHasSubscription(true);
        // User already has subscription, redirect to dashboard
        navigate("/dashboard");
        return;
      }
    }

    setCheckingSubscription(false);
  }, [navigate]);

  useEffect(() => {
    checkSubscription();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        await checkSubscription();
      } else {
        setCheckingSubscription(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSubscription]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningUp(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/subscribe`,
      },
    });

    setIsSigningUp(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
    } else {
      // If email confirmation is required, show message
      if (data.user && !data.session) {
        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account, then return here to subscribe.",
        });
        setEmail("");
        setPassword("");
      } else if (data.session) {
        // User is automatically signed in (if email confirmation is disabled)
        // Proceed to subscription
        setIsLoggedIn(true);
        toast({
          title: "Account created!",
          description: "Now let's set up your subscription.",
        });
        // The subscription check will run again and allow them to subscribe
      }
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        variant: "destructive",
        title: "Account required",
        description: "Please create an account first",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Call Supabase Edge Function to create Stripe checkout session
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast({
        variant: "destructive",
        title: "Subscription failed",
        description: error.message || "Something went wrong. Please try again.",
      });
      setIsLoading(false);
    }
  };

  if (checkingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (hasSubscription) {
    return null; // Will redirect
  }

  const features = [
    "Access to all six tabs (Bank, Income, Coaster, Bills, Real Bank, Abek)",
    "Track unlimited accounts and transactions",
    "Real-time balance calculations",
    "Coasting days and daily budget",
    "Bill management and reminders",
    "Survivor mode and financial insights",
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav />
      
      <section className="py-20 px-4 md:px-8 pt-32">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Subscribe to <span className="text-secondary">Abek</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get full access to all features for just $1 per month. Cancel anytime.
            </p>
          </div>

          <Card className="border-2 shadow-lg max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/20 mb-4">
                <DollarSign className="w-8 h-8 text-secondary" />
              </div>
              <CardTitle className="text-3xl">$1<span className="text-lg text-muted-foreground">/month</span></CardTitle>
              <CardDescription className="text-base mt-2">
                Simple, transparent pricing. No hidden fees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Show account creation if user is not logged in */}
              {!isLoggedIn && (
                <div className="pt-4 border-t">
                  <Tabs defaultValue="signup" className="w-full">
                    <TabsList className="grid w-full grid-cols-1">
                      <TabsTrigger value="signup">Create Your Account</TabsTrigger>
                    </TabsList>
                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                          />
                          <p className="text-xs text-muted-foreground">
                            Password must be at least 6 characters
                          </p>
                        </div>
                        <Button 
                          type="submit" 
                          variant="secondary" 
                          className="w-full" 
                          disabled={isSigningUp}
                        >
                          {isSigningUp ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating account...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      </form>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Already have an account?{" "}
                          <Button
                            variant="link"
                            className="p-0 h-auto text-secondary"
                            onClick={() => navigate("/auth")}
                          >
                            Sign in
                          </Button>
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Show subscribe button if user is logged in */}
              {isLoggedIn && (
              <div className="pt-4 border-t">
                <Button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  variant="hero"
                  size="lg"
                  className="w-full text-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe Now
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  By subscribing, you agree to our terms of service. You can cancel anytime.
                </p>
              </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
            >
              ← Back to Home
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Subscribe;

