import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Button, Card, CardContent, PageLoading, ErrorDisplay } from '@/components/shared';
import { useProjects } from '@/hooks/useApi';

export function OrdersProjectListPage() {
  const { data: projects, isLoading, error } = useProjects();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Orders</h1>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground">
              Create a project first to start managing orders.
            </p>
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
                      {project.part_number_prefix}
                    </p>
                  </div>
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/orders/open`}>Open</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/orders/ordered`}>Ordered</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/orders/received`}>Received</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/projects/${project.id}/orders/all`}>All</Link>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to={`/projects/${project.id}/orders/stats`}>View Statistics</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
