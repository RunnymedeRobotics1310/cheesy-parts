import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, CardFooter, ErrorDisplay, PageLoading } from '@/components/shared';
import { useUser, useCreateUser, useUpdateUser } from '@/hooks/useApi';

export function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingUser, isLoading } = useUser(id || '');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [permission, setPermission] = useState('readonly');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingUser) {
      setEmail(existingUser.email);
      setFirstName(existingUser.firstName);
      setLastName(existingUser.lastName);
      setPermission(existingUser.permission);
      setEnabled(existingUser.enabled ?? true);
    }
  }, [existingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isEditing) {
        await updateUser.mutateAsync({
          id,
          email,
          firstName,
          lastName,
          permission,
          enabled,
          ...(password ? { password } : {}),
        });
      } else {
        if (!password) {
          setError('Password is required for new users');
          return;
        }
        await createUser.mutateAsync({
          email,
          password,
          firstName,
          lastName,
          userPermission: permission,
          enabled,
        });
      }
      navigate('/users');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const permissionOptions = [
    { value: 'readonly', label: 'Read Only' },
    { value: 'editor', label: 'Editor' },
    { value: 'admin', label: 'Admin' },
  ];

  if (isEditing && isLoading) return <PageLoading />;

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit User' : 'New User'}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <ErrorDisplay error={error} />}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label={isEditing ? 'New Password (leave blank to keep current)' : 'Password'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEditing}
            />
            <Select
              label="Permission Level"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              options={permissionOptions}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Enabled (can log in)</span>
            </label>
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/users')} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createUser.isPending || updateUser.isPending}
              className="flex-1"
            >
              {isEditing ? 'Save Changes' : 'Create User'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
