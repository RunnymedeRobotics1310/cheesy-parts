import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Settings, ChevronRight, LayoutDashboard } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay, Select } from '@/components/shared';
import { useProject, useParts } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';
import { formatPartNumber, PART_STATUS_MAP, type Part, type PartStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function getStatusColor(status: PartStatus): 'default' | 'success' | 'warning' | 'info' | 'secondary' {
  if (status === 'done') return 'success';
  if (status === 'designing' || status === 'drawing') return 'info';
  if (status === 'material' || status === 'ordered') return 'warning';
  return 'secondary';
}

function getPriorityClass(priority: number): string {
  if (priority === 0) return 'border-l-4 border-l-red-500';
  if (priority === 2) return 'border-l-4 border-l-blue-300';
  return '';
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sort, setSort] = useState('part_number');
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id!);
  const { data: parts, isLoading: partsLoading, error: partsError } = useParts(id!, sort);

  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';

  if (projectLoading || partsLoading) return <PageLoading />;
  if (projectError) return <ErrorDisplay error={projectError} />;
  if (partsError) return <ErrorDisplay error={partsError} />;
  if (!project) return <ErrorDisplay error="Project not found" />;

  // Build hierarchy map
  const partsById = new Map(parts?.map((p) => [p.id, p]) || []);
  const topLevelParts = parts?.filter((p) => !p.parent_part_id) || [];

  const sortOptions = [
    { value: 'part_number', label: 'Part Number' },
    { value: 'name', label: 'Name' },
    { value: 'type', label: 'Type' },
    { value: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">
            Part Number Prefix: {project.part_number_prefix}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${id}/dashboard`}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/projects/${id}/edit`}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button asChild>
                <Link to={`/projects/${id}/parts/new?type=assembly`}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Assembly
                </Link>
              </Button>
              <Button asChild>
                <Link to={`/projects/${id}/parts/new?type=part`}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Part
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={sortOptions}
          className="w-40"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parts ({parts?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {parts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No parts yet. Create your first part or assembly.
            </div>
          ) : (
            <div className="space-y-1">
              {topLevelParts.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  project={project}
                  partsById={partsById}
                  allParts={parts!}
                  level={0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PartRowProps {
  part: Part;
  project: { part_number_prefix: string };
  partsById: Map<string, Part>;
  allParts: Part[];
  level: number;
}

function PartRow({ part, project, partsById, allParts, level }: PartRowProps) {
  const children = allParts.filter((p) => p.parent_part_id === part.id);

  return (
    <>
      <Link
        to={`/parts/${part.id}`}
        className={cn(
          'flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors',
          getPriorityClass(part.priority)
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {children.length > 0 && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {children.length === 0 && level > 0 && <div className="w-4" />}
        <span className="font-mono text-sm w-32 flex-shrink-0">
          {formatPartNumber(project, part)}
        </span>
        <span className="flex-1 truncate">{part.name}</span>
        <Badge variant={getStatusColor(part.status)}>
          {PART_STATUS_MAP[part.status]}
        </Badge>
      </Link>
      {children.map((child) => (
        <PartRow
          key={child.id}
          part={child}
          project={project}
          partsById={partsById}
          allParts={allParts}
          level={level + 1}
        />
      ))}
    </>
  );
}
