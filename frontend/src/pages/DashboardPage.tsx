import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay, Select } from '@/components/shared';
import { useDashboard, useUpdatePartStatus } from '@/hooks/useApi';
import { formatPartNumber, PART_STATUS_MAP, PART_STATUSES, type Part, type PartStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAuthSession } from '@/lib/api';

function getPriorityClass(priority: number): string {
  if (priority === 0) return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20';
  if (priority === 2) return 'border-l-4 border-l-blue-300 bg-blue-50 dark:bg-blue-950/20';
  return 'border-l-4 border-l-transparent';
}

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [statusFilter, setStatusFilter] = useState<PartStatus | ''>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, error, refetch } = useDashboard(
    id!,
    statusFilter || undefined,
    autoRefresh ? 10000 : undefined
  );

  const updateStatus = useUpdatePartStatus();
  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';

  // Manual refresh countdown
  const [countdown, setCountdown] = useState(10);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 10 : c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleStatusChange = async (partId: string, newStatus: PartStatus) => {
    if (!canEdit) return;
    await updateStatus.mutateAsync({ id: partId, status: newStatus });
  };

  const filterOptions = [
    { value: '', label: 'All Statuses' },
    ...PART_STATUSES.filter((s) => s !== 'done').map((s) => ({
      value: s,
      label: PART_STATUS_MAP[s],
    })),
  ];

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return <ErrorDisplay error="Dashboard data not found" />;

  const statusGroups = statusFilter
    ? { [statusFilter]: data.partsByStatus[statusFilter] }
    : data.partsByStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.project.name} Dashboard</h1>
          <p className="text-muted-foreground">
            {data.totalParts} active parts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
              {autoRefresh ? `Auto-refresh (${countdown}s)` : 'Auto-refresh off'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh Now
            </Button>
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PartStatus | '')}
            options={filterOptions}
            className="w-64"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(statusGroups).map(([status, parts]) => {
          if (status === 'done' || (parts as Part[]).length === 0) return null;

          return (
            <Card key={status} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{PART_STATUS_MAP[status as PartStatus]}</span>
                  <Badge variant="secondary">{(parts as Part[]).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 overflow-auto max-h-96">
                {(parts as Part[]).map((part) => (
                  <div
                    key={part.id}
                    className={cn(
                      'p-2 rounded border bg-card hover:bg-muted/50 transition-colors',
                      getPriorityClass(part.priority)
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/parts/${part.id}`}
                          className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {formatPartNumber({ part_number_prefix: data.project.part_number_prefix }, part)}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <p className="text-sm font-medium truncate">{part.name}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <select
                        value={part.status}
                        onChange={(e) => handleStatusChange(part.id, e.target.value as PartStatus)}
                        className="mt-2 w-full text-xs p-1 rounded border bg-background"
                        disabled={updateStatus.isPending}
                      >
                        {PART_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PART_STATUS_MAP[s]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
