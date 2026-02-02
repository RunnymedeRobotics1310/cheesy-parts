import { Link } from 'react-router-dom';
import { Plus, FolderKanban, LayoutDashboard, ShoppingCart } from 'lucide-react';
import { Button, Card, CardContent, PageLoading, ErrorDisplay } from '@/components/shared';
import { useProjects } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';

export function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        {canEdit && (
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first project to start tracking parts.
            </p>
            {canEdit && (
              <Button asChild>
                <Link to="/projects/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Card key={project.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Prefix: {project.part_number_prefix}
                    </p>
                  </div>
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link to={`/projects/${project.id}`}>
                      View Parts
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/dashboard`}>
                      <LayoutDashboard className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/orders/open`}>
                      <ShoppingCart className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
