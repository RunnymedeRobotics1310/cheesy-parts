import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Filter, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay, Input } from '@/components/shared';
import { useProject, useAllOrders, useVendors, useOrderStats } from '@/hooks/useApi';
import { formatCurrency, calculateOrderTotal } from '@/lib/utils';
import type { Order } from '@/lib/types';

function OrderCard({ order }: { order: Order }) {
  const total = calculateOrderTotal(order.order_items || [], order.tax_cost, order.shipping_cost);

  const statusColor = order.status === 'open' ? 'warning' : order.status === 'ordered' ? 'info' : 'success';

  return (
    <Link
      to={`/orders/${order.id}`}
      className="block p-4 border rounded-lg hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{order.vendor_name}</h3>
        <div className="flex gap-2">
          <Badge variant={statusColor}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          <Badge variant="secondary">{order.order_items?.length || 0} items</Badge>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Total: {formatCurrency(total)}</p>
        {order.ordered_at && <p>Ordered: {new Date(order.ordered_at).toLocaleDateString()}</p>}
        {order.paid_for_by && <p>Paid by: {order.paid_for_by}</p>}
        {order.reimbursed && <span className="text-green-600">Reimbursed</span>}
      </div>
    </Link>
  );
}

export function AllOrdersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorFilter = searchParams.get('vendor') || '';
  const purchaserFilter = searchParams.get('purchaser') || '';

  const [localVendor, setLocalVendor] = useState(vendorFilter);
  const [localPurchaser, setLocalPurchaser] = useState(purchaserFilter);

  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: orders, isLoading: ordersLoading } = useAllOrders(projectId!, {
    vendor: vendorFilter || undefined,
    purchaser: purchaserFilter || undefined,
  });
  const { data: vendors } = useVendors();
  const { data: stats } = useOrderStats(projectId!);

  // Get unique purchasers from stats
  const purchasers = stats ? Object.keys(stats.byPurchaser).filter(p => p !== 'Unknown') : [];

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (localVendor) params.set('vendor', localVendor);
    if (localPurchaser) params.set('purchaser', localPurchaser);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setLocalVendor('');
    setLocalPurchaser('');
    setSearchParams({});
  };

  const hasActiveFilters = vendorFilter || purchaserFilter;

  if (projectLoading || ordersLoading) return <PageLoading />;
  if (!project) return <ErrorDisplay error="Project not found" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/orders" className="hover:underline">Orders</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/projects/${projectId}/orders/open`} className="hover:underline">{project.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span>All Orders</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/projects/${projectId}/orders/open`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">All Orders</h1>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Vendor"
                value={localVendor}
                onChange={(e) => setLocalVendor(e.target.value)}
                list="vendors-list"
                placeholder="Filter by vendor..."
              />
              <datalist id="vendors-list">
                {vendors?.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Purchaser"
                value={localPurchaser}
                onChange={(e) => setLocalPurchaser(e.target.value)}
                list="purchasers-list"
                placeholder="Filter by purchaser..."
              />
              <datalist id="purchasers-list">
                {purchasers.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>
                Apply
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {vendorFilter && (
                <Badge variant="secondary">
                  Vendor: {vendorFilter}
                </Badge>
              )}
              {purchaserFilter && (
                <Badge variant="secondary">
                  Purchaser: {purchaserFilter}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        Showing {orders?.length || 0} order{orders?.length !== 1 ? 's' : ''}
      </div>

      {orders?.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No orders match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders?.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
