import { Link } from 'react-router-dom';
import { Plus, UserCheck, UserX, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay } from '@/components/shared';
import { useUsers, useUpdateUser, useDeleteUser } from '@/hooks/useApi';
import type { User } from '@/lib/types';

function getPermissionBadge(permission: string) {
  switch (permission) {
    case 'admin':
      return <Badge variant="destructive">Admin</Badge>;
    case 'editor':
      return <Badge variant="default">Editor</Badge>;
    default:
      return <Badge variant="secondary">Read Only</Badge>;
  }
}

export function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const handleToggleEnabled = async (user: User) => {
    if (confirm(`${user.enabled ? 'Disable' : 'Enable'} ${user.firstName} ${user.lastName}?`)) {
      await updateUser.mutateAsync({ id: user.id, enabled: !user.enabled });
    }
  };

  const handleDelete = async (user: User) => {
    if (confirm(`Delete ${user.firstName} ${user.lastName}? This cannot be undone.`)) {
      await deleteUser.mutateAsync(user.id);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Users</h1>
        <Button asChild>
          <Link to="/users/new">
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Permission</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      {getPermissionBadge(user.permission)}
                    </td>
                    <td className="py-3 px-4">
                      {user.enabled ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : (
                        <Badge variant="warning">Disabled</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleEnabled(user)}
                          title={user.enabled ? 'Disable user' : 'Enable user'}
                        >
                          {user.enabled ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/users/${user.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
