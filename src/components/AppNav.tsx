import { Link, useLocation } from "react-router-dom";
import { Wallet, TrendingUp, Beer, FileText, CheckCircle, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Profile from "./Profile";

const AppNav = () => {
  const location = useLocation();

  const navItems = [
    { name: "Bank", path: "/dashboard", icon: Wallet },
    { name: "Income", path: "/income", icon: TrendingUp },
    { name: "Coaster", path: "/coaster", icon: Beer },
    { name: "Bills", path: "/bills", icon: FileText },
    { name: "Close Out", path: "/closeout", icon: CheckCircle },
    { name: "Survivor", path: "/survivor", icon: LifeBuoy },
  ];

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
          {navItems.map((item) => {
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
        <div className="grid grid-cols-7 gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="h-12 flex-col gap-1 px-1"
                  size="sm"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{item.name}</span>
                </Button>
              </Link>
            );
          })}
          <Profile />
        </div>
      </nav>
    </>
  );
};

export default AppNav;
