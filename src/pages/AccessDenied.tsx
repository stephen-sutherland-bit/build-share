import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AccessDenied = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-strong border-destructive/50">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-display">Access Denied</CardTitle>
            <CardDescription>
              Your account does not have permission to access this application
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2 text-sm text-muted-foreground">
            <p>You're logged in as:</p>
            <p className="font-medium text-foreground">{user?.email}</p>
            <p className="pt-2">
              Please contact the administrator (Stephen@westernmaintenance.com.au) to request access to this application.
            </p>
          </div>
          <Button
            onClick={() => signOut()}
            variant="outline"
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessDenied;
