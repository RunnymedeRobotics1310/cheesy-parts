import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ChevronRight, Package, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageLoading, ErrorDisplay, Input } from '@/components/shared';
import { useProject, useOrders, useUnclassifiedOrderItems, useCreateOrderItem, useDeleteOrderItem, useVendors } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Order, OrderItem } from '@/lib/types';

function OrderCard({ order }: { order: Order }) {
  const itemsTotal = (order.order_items || []).reduce(
    (sum, item) => sum + item.quantity * item.unit_cost,
    0
  );
  const total = itemsTotal + order.tax_cost + order.shipping_cost;

  return (
    <Link
      to={`/orders/${order.id}`}
      className="block p-4 border rounded-lg hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{order.vendor_name}</h3>
        <Badge variant="secondary">{order.order_items?.length || 0} items</Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Total: {formatCurrency(total)}</p>
        {order.ordered_at && <p>Ordered: {new Date(order.ordered_at).toLocaleDateString()}</p>}
        {order.paid_for_by && <p>Paid by: {order.paid_for_by}</p>}
      </div>
    </Link>
  );
}

export function OrdersPage() {
  const { id: projectId, status } = useParams<{ id: string; status: string }>();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: orders, isLoading: ordersLoading } = useOrders(projectId!, status);
  const { data: unclassifiedItems } = useUnclassifiedOrderItems(projectId!);
  const { data: vendors } = useVendors();
  const createOrderItem = useCreateOrderItem();
  const deleteOrderItem = useDeleteOrderItem();

  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    vendor: '',
    quantity: '1',
    partNumber: '',
    description: '',
    unitCost: '',
    notes: '',
  });

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrderItem.mutateAsync({
      projectId: projectId!,
      vendor: newItem.vendor || undefined,
      quantity: parseInt(newItem.quantity) || 1,
      partNumber: newItem.partNumber,
      description: newItem.description,
      unitCost: parseFloat(newItem.unitCost) || 0,
      notes: newItem.notes,
    });
    setNewItem({ vendor: '', quantity: '1', partNumber: '', description: '', unitCost: '', notes: '' });
    setShowNewItemForm(false);
  };

  const handleDeleteItem = async (item: OrderItem) => {
    if (confirm(`Delete item "${item.description || item.part_number}"?`)) {
      await deleteOrderItem.mutateAsync(item.id);
    }
  };

  if (projectLoading || ordersLoading) return <PageLoading />;
  if (!project) return <ErrorDisplay error="Project not found" />;

  const statusTabs = [
    { key: 'open', label: 'Open' },
    { key: 'ordered', label: 'Ordered' },
    { key: 'received', label: 'Received' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/orders" className="hover:underline">Orders</Link>
        <ChevronRight className="h-4 w-4" />
        <span>{project.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{project.name} Orders</h1>
        <Button variant="outline" asChild>
          <Link to={`/projects/${projectId}/orders/stats`}>View Statistics</Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b">
        {statusTabs.map((tab) => (
          <Link
            key={tab.key}
            to={`/projects/${projectId}/orders/${tab.key}`}
            className={`px-4 py-2 border-b-2 transition-colors ${
              status === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Unclassified items (only show on open tab) */}
      {status === 'open' && unclassifiedItems && unclassifiedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unclassified Items ({unclassifiedItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unclassifiedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-mono text-sm">{item.part_number}</span>
                    <span className="ml-2">{item.description}</span>
                    <span className="ml-2 text-muted-foreground">
                      {item.quantity} x {formatCurrency(item.unit_cost)}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/projects/${projectId}/order-items/${item.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New item form */}
      {status === 'open' && canEdit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Add Item</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewItemForm(!showNewItemForm)}
            >
              {showNewItemForm ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> New Item</>}
            </Button>
          </CardHeader>
          {showNewItemForm && (
            <CardContent>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Vendor"
                    value={newItem.vendor}
                    onChange={(e) => setNewItem({ ...newItem, vendor: e.target.value })}
                    list="vendors-list"
                    placeholder="Leave empty for unclassified"
                  />
                  <datalist id="vendors-list">
                    {vendors?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  <Input
                    label="Part Number"
                    value={newItem.partNumber}
                    onChange={(e) => setNewItem({ ...newItem, partNumber: e.target.value })}
                  />
                  <Input
                    label="Description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <Input
                    label="Quantity"
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    min="1"
                  />
                  <Input
                    label="Unit Cost ($)"
                    type="number"
                    step="0.01"
                    value={newItem.unitCost}
                    onChange={(e) => setNewItem({ ...newItem, unitCost: e.target.value })}
                  />
                  <Input
                    label="Notes"
                    value={newItem.notes}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" isLoading={createOrderItem.isPending}>
                  Add Item
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      {/* Orders list */}
      {orders?.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No {status} orders</p>
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
