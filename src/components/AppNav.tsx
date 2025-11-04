import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Wallet, TrendingUp, Beer, FileText, CheckCircle, LifeBuoy, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Profile from "./Profile";

const AppNav = () => {
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email || null);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { name: "Bank", path: "/dashboard", icon: Wallet },
    { name: "Income", path: "/income", icon: TrendingUp },
    { name: "Coaster", path: "/coaster", icon: Beer },
    { name: "Real Bank", path: "/realbank", icon: DollarSign, restricted: true },
    { name: "Bills", path: "/bills", icon: FileText },
    { name: "Close Out", path: "/closeout", icon: CheckCircle },
    { name: "Survivor", path: "/survivor", icon: LifeBuoy },
  ];

  // Filter nav items based on user email
  const filteredNavItems = navItems.filter(item => {
    if (item.restricted && userEmail !== "dani@gmail.com") {
      return false;
    }
    return true;
  });

  const handleProfileClick = () => {
    // This will be handled by the Profile component's dialog
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r flex-col p-4 shadow-card">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">My Budget Bar</h2>
          <p className="text-sm text-muted-foreground">Your Financial Tab</p>
        </div>
        
        <div className="flex-1 space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
          <Profile />
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 shadow-card">
        <div className="max-w-screen-sm mx-auto w-full px-2">
          <div className="grid grid-cols-7 gap-1 py-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className="block w-full">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="h-12 w-full flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium"
                  size="sm"
                >
                  <Icon className="w-4 h-4" />
                  <span className="leading-tight text-center">{item.name}</span>
                </Button>
              </Link>
            );
          })}
          <Profile />
          </div>
        </div>
      </nav>
    </>
  );
};

export default AppNav;
