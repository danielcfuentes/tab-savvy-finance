import { Link, useLocation } from "react-router-dom";
import { Wallet, TrendingUp, Beer, FileText, CheckCircle, LifeBuoy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const AppNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const navItems = [
    { name: "Bank", path: "/dashboard", icon: Wallet },
    { name: "Income", path: "/income", icon: TrendingUp },
    { name: "Coaster", path: "/coaster", icon: Beer },
    { name: "Bills", path: "/bills", icon: FileText },
    { name: "Close Out", path: "/closeout", icon: CheckCircle },
    { name: "Survivor", path: "/survivor", icon: LifeBuoy },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out",
      });
    } else {
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
      navigate("/");
    }
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-primary/10 flex-col p-6 shadow-lg">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="text-2xl">🍻</span>
            My Budget Bar
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Your Financial Tab</p>
        </div>
        
        <div className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 transition-all duration-200 ${
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>

        <Button variant="ghost" className="mt-auto justify-start gap-3" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 shadow-card">
        <div className="grid grid-cols-6 gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full h-14 flex-col gap-1 px-1"
                  size="sm"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{item.name}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default AppNav;
