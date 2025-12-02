import { Building2, Settings, LogOut, ShieldCheck, Shield, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

export const Header = () => {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft transition-spring group-hover:shadow-medium group-hover:scale-105">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-display font-bold tracking-tight text-foreground">
              BuildPost AI
            </span>
            <span className="text-xs text-muted-foreground tracking-tight">
              Construction Content Creator
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-full ring-1 ring-border/50 hover:ring-primary/50 hover:bg-muted transition-smooth"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-1 ring-border hover:ring-primary/50 transition-smooth">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-semibold">
                    {getInitials(user.email || 'U')}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 shadow-strong border-border/50" align="end" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-medium leading-none tracking-tight">{user.email}</p>
                  {role === 'admin' && (
                    <p className="text-xs leading-none text-primary flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Administrator
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted">
                <Link to="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Company Settings</span>
                </Link>
              </DropdownMenuItem>
              {role === 'admin' && (
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-muted">
                  <Link to="/admin" className="flex items-center">
                    <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Admin Panel</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem 
                onClick={() => signOut()} 
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
