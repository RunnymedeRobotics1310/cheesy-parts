import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Settings, ChevronRight, LayoutDashboard, ChevronUp, ChevronDown } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay } from '@/components/shared';
import { useProject, useParts, useUpdatePartStatus } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';
import { formatPartNumber, PART_STATUS_MAP, PART_STATUSES, type Part, type PartStatus } from '@/lib/types';
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

type SortField = 'part_number' | 'name' | 'type' | 'status';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sort, setSort] = useState<SortField>('part_number');
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

  const handleSort = (field: SortField) => {
    setSort(field);
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center gap-1 font-medium hover:text-primary transition-colors',
        sort === field && 'text-primary'
      )}
    >
      {label}
      {sort === field ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4 opacity-30" />
      )}
    </button>
  );

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
            <>
              {/* Column Headers */}
              <div className="flex items-center gap-4 p-3 border-b mb-2 text-sm">
                <div className="w-4" /> {/* Spacer for chevron */}
                <div className="w-32 flex-shrink-0">
                  <SortHeader field="part_number" label="Part #" />
                </div>
                <div className="w-20 flex-shrink-0">
                  <SortHeader field="type" label="Type" />
                </div>
                <div className="flex-1">
                  <SortHeader field="name" label="Name" />
                </div>
                <div className="w-40">
                  <SortHeader field="status" label="Status" />
                </div>
              </div>
              <div className="space-y-1">
                {topLevelParts.map((part) => (
                  <PartRow
                    key={part.id}
                    part={part}
                    project={project}
                    partsById={partsById}
                    allParts={parts!}
                    level={0}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </>
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
  canEdit: boolean;
}

function PartRow({ part, project, partsById, allParts, level, canEdit }: PartRowProps) {
  const children = allParts.filter((p) => p.parent_part_id === part.id);
  const updateStatus = useUpdatePartStatus();
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = e.target.value as PartStatus;
    await updateStatus.mutateAsync({ id: part.id, status: newStatus });
    setIsEditingStatus(false);
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    if (canEdit) {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingStatus(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors group',
          getPriorityClass(part.priority)
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {children.length > 0 ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}
        <Link
          to={`/parts/${part.id}`}
          className="font-mono text-sm w-32 flex-shrink-0 hover:underline"
        >
          {formatPartNumber(project, part)}
        </Link>
        <span className="w-20 flex-shrink-0 text-sm text-muted-foreground capitalize">
          {part.type}
        </span>
        <Link
          to={`/parts/${part.id}`}
          className="flex-1 truncate hover:underline"
        >
          {part.name}
        </Link>
        <div className="w-40" onClick={handleStatusClick}>
          {isEditingStatus ? (
            <select
              value={part.status}
              onChange={handleStatusChange}
              onBlur={() => setIsEditingStatus(false)}
              autoFocus
              className="w-full text-sm border rounded px-2 py-1 bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              {PART_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PART_STATUS_MAP[s]}
                </option>
              ))}
            </select>
          ) : (
            <Badge
              variant={getStatusColor(part.status)}
              className={cn(canEdit && 'cursor-pointer hover:opacity-80')}
            >
              {PART_STATUS_MAP[part.status]}
            </Badge>
          )}
        </div>
      </div>
      {children.map((child) => (
        <PartRow
          key={child.id}
          part={child}
          project={project}
          partsById={partsById}
          allParts={allParts}
          level={level + 1}
          canEdit={canEdit}
        />
      ))}
    </>
  );
}
