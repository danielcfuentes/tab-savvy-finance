import { Link, useLocation } from "react-router-dom";
import { Wallet, TrendingUp, Beer, FileText, LifeBuoy, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import Profile from "./Profile";

const AppNav = () => {
  const location = useLocation();

  const navItems = [
    { name: "Bank", path: "/dashboard", icon: Wallet },
    { name: "Income", path: "/income", icon: TrendingUp },
    { name: "Coaster", path: "/coaster", icon: Beer },
    { name: "Real Bank", path: "/realbank", icon: DollarSign },
    { name: "Bills", path: "/bills", icon: FileText },
    { name: "Abek", path: "/survivor", icon: LifeBuoy },
  ];

  const handleProfileClick = () => {
    // This will be handled by the Profile component's dialog
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r flex-col p-4 shadow-card">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Abek</h2>
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
        <div className="w-full px-0.5">
          <div className="flex items-center gap-0 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className="flex-1 min-w-0">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="h-12 w-full flex flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-medium"
                  size="sm"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="leading-tight text-center truncate w-full">{item.name}</span>
                </Button>
              </Link>
            );
          })}
          <div className="flex-1 min-w-0">
            <Profile />
          </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default AppNav;
