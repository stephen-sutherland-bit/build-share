import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, role, loading, roleError, retryRoleFetch } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If there was a network error fetching role, show retry option
  if (roleError) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="text-center p-8 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">Connection Error</h2>
          <p className="text-muted-foreground mb-4">
            Unable to verify your permissions. Please check your internet connection and try again.
          </p>
          <Button onClick={retryRoleFetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
