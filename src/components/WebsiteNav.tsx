import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LifeBuoy } from "lucide-react";

const WebsiteNav = () => {
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "How It Works", path: "/how-it-works" },
    { name: "Testimonials", path: "/testimonials" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b shadow-sm">
      <div className="container mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-secondary/20 p-2 rounded-lg group-hover:bg-secondary/30 transition-smooth">
              <LifeBuoy className="w-6 h-6 text-secondary" />
            </div>
            <span className="text-2xl font-bold text-foreground">Abek</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="transition-smooth"
                  >
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.href = "/auth"}
              className="hidden sm:flex"
            >
              Sign In
            </Button>
            <Button
              variant="hero"
              onClick={() => window.location.href = "/auth"}
              className="text-sm sm:text-base"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4 flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs"
                >
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default WebsiteNav;

