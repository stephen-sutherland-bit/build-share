import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Trash2, ArrowLeft } from "lucide-react";

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminPanel() {
  const { hasRole } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;
      setUserRoles(roles || []);

      // Fetch all auth users (admin only)
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) throw usersError;
      setAuthUsers(users.map(u => ({
        id: u.id,
        email: u.email || 'No email',
        created_at: u.created_at || ''
      })));
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const addRole = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select both a user and role");
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUserId, role: selectedRole });

      if (error) throw error;

      toast.success("Role added successfully");
      setSelectedUserId("");
      fetchData();
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast.error(error.message || "Failed to add role");
    }
  };

  const removeRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success("Role removed successfully");
      fetchData();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast.error("Failed to remove role");
    }
  };

  if (!hasRole('admin')) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getUserEmail = (userId: string) => {
    return authUsers.find(u => u.id === userId)?.email || userId;
  };

  const usersWithoutRoles = authUsers.filter(
    user => !userRoles.some(role => role.user_id === user.id)
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        
        <h1 className="text-4xl font-bold mb-8 text-foreground">Admin Panel</h1>

        {/* Add New Role */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add User Role</CardTitle>
            <CardDescription>Grant access to users by assigning them a role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {authUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={(value: 'admin' | 'user') => setSelectedRole(value)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={addRole} disabled={!selectedUserId}>
                Add Role
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current User Roles */}
        <Card>
          <CardHeader>
            <CardTitle>Current User Roles</CardTitle>
            <CardDescription>Manage existing user access and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : userRoles.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No users have been assigned roles yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((userRole) => (
                      <TableRow key={userRole.id}>
                        <TableCell className="font-medium">
                          {getUserEmail(userRole.user_id)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userRole.role === 'admin' 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-secondary text-secondary-foreground'
                          }`}>
                            {userRole.role}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(userRole.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRole(userRole.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users without roles */}
        {usersWithoutRoles.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Users Without Roles</CardTitle>
              <CardDescription>These users have signed up but don't have access yet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {usersWithoutRoles.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Signed up {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
