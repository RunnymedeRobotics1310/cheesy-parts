import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, ErrorDisplay, PageLoading } from '@/components/shared';
import { useProject, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useApi';
import { Trash2 } from 'lucide-react';

export function ProjectFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existingProject, isLoading } = useProject(id || '');
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [name, setName] = useState('');
  const [partNumberPrefix, setPartNumberPrefix] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingProject) {
      setName(existingProject.name);
      setPartNumberPrefix(existingProject.part_number_prefix);
    }
  }, [existingProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isEditing) {
        await updateProject.mutateAsync({ id, name, partNumberPrefix });
        navigate(`/projects/${id}`);
      } else {
        const project = await createProject.mutateAsync({ name, partNumberPrefix });
        navigate(`/projects/${project.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(id!);
      navigate('/projects');
    } catch (err: any) {
      setError(err.message);
      setShowDeleteConfirm(false);
    }
  };

  if (isEditing && isLoading) return <PageLoading />;

  if (showDeleteConfirm) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Delete Project</CardTitle>
            <CardDescription>
              Are you sure you want to delete "{existingProject?.name}"? This will also delete all parts and orders associated with this project. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <ErrorDisplay error={error} />}
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              isLoading={deleteProject.isPending}
              className="flex-1"
            >
              Delete Project
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Project' : 'New Project'}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the project details below.'
              : 'Create a new project to start tracking parts.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <ErrorDisplay error={error} />}
            <Input
              label="Project Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2024 Robot"
              required
            />
            <Input
              label="Part Number Prefix"
              value={partNumberPrefix}
              onChange={(e) => setPartNumberPrefix(e.target.value.toUpperCase())}
              placeholder="e.g., 254"
              required
              maxLength={10}
            />
            <p className="text-sm text-muted-foreground">
              Parts will be numbered as {partNumberPrefix || 'XXX'}-P-0001, assemblies as {partNumberPrefix || 'XXX'}-A-0100
            </p>
          </CardContent>
          <CardFooter className="flex gap-4">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditing ? `/projects/${id}` : '/projects')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createProject.isPending || updateProject.isPending}
              className="flex-1"
            >
              {isEditing ? 'Save Changes' : 'Create Project'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
