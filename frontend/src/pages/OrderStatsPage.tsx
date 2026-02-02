import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay } from '@/components/shared';
import { useProject, useOrderStats } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';

export function OrderStatsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: stats, isLoading: statsLoading, error } = useOrderStats(projectId!);

  if (projectLoading || statsLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;
  if (!project || !stats) return <ErrorDisplay error="Data not found" />;

  const vendorEntries = Object.entries(stats.byVendor).sort((a, b) => b[1].totalCost - a[1].totalCost);
  const purchaserEntries = Object.entries(stats.byPurchaser);

  const totalSpent = vendorEntries.reduce((sum, [, data]) => sum + data.totalCost, 0);
  const totalReimbursed = purchaserEntries.reduce((sum, [, data]) => sum + data.reimbursed, 0);
  const totalOutstanding = purchaserEntries.reduce((sum, [, data]) => sum + data.outstanding, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/projects/${projectId}/orders/open`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{project.name} Order Statistics</h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Across {vendorEntries.length} vendors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reimbursed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReimbursed)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalOutstanding)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Vendor */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No orders yet.</p>
            ) : (
              <div className="space-y-4">
                {vendorEntries.map(([vendor, data]) => (
                  <div key={vendor} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{vendor}</span>
                      <span className="font-bold">{formatCurrency(data.totalCost)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(data.totalCost / totalSpent) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {data.orders.length} order(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Purchaser */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Purchaser</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaserEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Purchaser</th>
                      <th className="text-right py-2 font-medium">Reimbursed</th>
                      <th className="text-right py-2 font-medium">Outstanding</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaserEntries.map(([purchaser, data]) => (
                      <tr key={purchaser} className="border-b">
                        <td className="py-3">{purchaser}</td>
                        <td className="py-3 text-right text-green-600">
                          {formatCurrency(data.reimbursed)}
                        </td>
                        <td className="py-3 text-right">
                          {data.outstanding > 0 ? (
                            <Badge variant="warning">{formatCurrency(data.outstanding)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(data.reimbursed + data.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td className="py-3">Total</td>
                      <td className="py-3 text-right text-green-600">{formatCurrency(totalReimbursed)}</td>
                      <td className="py-3 text-right text-yellow-600">{formatCurrency(totalOutstanding)}</td>
                      <td className="py-3 text-right">{formatCurrency(totalSpent)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
