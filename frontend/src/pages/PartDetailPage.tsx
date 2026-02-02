import { Link, useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay, Select } from '@/components/shared';
import { usePart, useParts, useUpdatePartStatus, useDeletePart, useSettings } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';
import { formatPartNumber, PART_STATUS_MAP, PART_STATUSES, PART_PRIORITY_MAP, type PartStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function getStatusColor(status: PartStatus): 'default' | 'success' | 'warning' | 'info' | 'secondary' {
  if (status === 'done') return 'success';
  if (status === 'designing' || status === 'drawing') return 'info';
  if (status === 'material' || status === 'ordered') return 'warning';
  return 'secondary';
}

export function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: part, isLoading, error } = usePart(id!);
  const { data: allParts } = useParts(part?.project_id || '', 'part_number');
  const { data: settings } = useSettings();
  const updateStatus = useUpdatePartStatus();
  const deletePart = useDeletePart();

  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';
  const hideUnusedFields = settings?.hide_unused_fields ?? false;

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;
  if (!part) return <ErrorDisplay error="Part not found" />;

  const project = part.project!;
  const childParts = allParts?.filter((p) => p.parent_part_id === part.id) || [];
  const parentPart = allParts?.find((p) => p.id === part.parent_part_id);

  const handleStatusChange = async (newStatus: PartStatus) => {
    await updateStatus.mutateAsync({ id: part.id, status: newStatus });
  };

  const handleDelete = async () => {
    if (childParts.length > 0) {
      alert("Can't delete assembly with existing children. Delete children first.");
      return;
    }
    if (confirm(`Delete ${formatPartNumber(project, part)}? This cannot be undone.`)) {
      await deletePart.mutateAsync(part.id);
      navigate(`/projects/${project.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/projects/${project.id}`} className="hover:underline">
              {project.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
            {parentPart && (
              <>
                <Link to={`/parts/${parentPart.id}`} className="hover:underline">
                  {formatPartNumber(project, parentPart)}
                </Link>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            <span>{formatPartNumber(project, part)}</span>
          </div>
          <h1 className="text-3xl font-bold">{part.name}</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/parts/${id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Part Number</label>
                <p className="font-mono">{formatPartNumber(project, part)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type</label>
                <p className="capitalize">{part.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <p className={cn(
                  part.priority === 0 && 'text-red-600 font-semibold',
                  part.priority === 2 && 'text-blue-500'
                )}>
                  {PART_PRIORITY_MAP[part.priority as 0 | 1 | 2]}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Drawing Created</label>
                <p>{part.drawing_created ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              {canEdit ? (
                <Select
                  value={part.status}
                  onChange={(e) => handleStatusChange(e.target.value as PartStatus)}
                  options={PART_STATUSES.map((s) => ({ value: s, label: PART_STATUS_MAP[s] }))}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1">
                  <Badge variant={getStatusColor(part.status)}>
                    {PART_STATUS_MAP[part.status]}
                  </Badge>
                </div>
              )}
            </div>

            {part.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="whitespace-pre-wrap">{part.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!hideUnusedFields && (
          <Card>
            <CardHeader>
              <CardTitle>Material</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source Material</label>
                  <p>{part.source_material || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Have Material</label>
                  <p>{part.have_material ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                  <p>{part.quantity || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cut Length</label>
                  <p>{part.cut_length || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {part.type === 'assembly' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Child Parts ({childParts.length})</CardTitle>
            {canEdit && (
              <div className="flex gap-2">
                <Button size="sm" asChild>
                  <Link to={`/projects/${project.id}/parts/new?type=part&parentPartId=${part.id}`}>
                    Add Part
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/projects/${project.id}/parts/new?type=assembly&parentPartId=${part.id}`}>
                    Add Sub-Assembly
                  </Link>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {childParts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No child parts yet.</p>
            ) : (
              <div className="space-y-1">
                {childParts.map((child) => (
                  <Link
                    key={child.id}
                    to={`/parts/${child.id}`}
                    className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors"
                  >
                    <span className="font-mono text-sm w-32 flex-shrink-0">
                      {formatPartNumber(project, child)}
                    </span>
                    <span className="flex-1 truncate">{child.name}</span>
                    <Badge variant={getStatusColor(child.status)}>
                      {PART_STATUS_MAP[child.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
