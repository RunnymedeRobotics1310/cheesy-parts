import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { Button, Card, CardContent, PageLoading, ErrorDisplay } from '@/components/shared';
import { useProjects } from '@/hooks/useApi';

export function DashboardsPage() {
  const { data: projects, isLoading, error } = useProjects();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;

  // Filter out hidden dashboards
  const visibleProjects = projects?.filter((p) => !p.hide_dashboards) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboards</h1>

      {visibleProjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No dashboards available</h3>
            <p className="text-muted-foreground">
              Create a project to see its dashboard here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleProjects.map((project) => (
            <Card key={project.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.part_number_prefix}
                    </p>
                  </div>
                  <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                </div>
                <Button className="w-full" asChild>
                  <Link to={`/projects/${project.id}/dashboard`}>
                    Open Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
