import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Pencil, Save, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input, Select, PageLoading, ErrorDisplay } from '@/components/shared';
import { useOrder, useUpdateOrder, useDeleteOrder, useUpdateOrderItem, useDeleteOrderItem } from '@/hooks/useApi';
import { getAuthSession } from '@/lib/api';
import { formatCurrency, calculateOrderTotal } from '@/lib/utils';
import type { OrderItem } from '@/lib/types';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(orderId!);
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const updateOrderItem = useUpdateOrderItem();
  const deleteOrderItem = useDeleteOrderItem();

  const session = getAuthSession();
  const canEdit = session?.user?.permission === 'editor' || session?.user?.permission === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState({
    status: '',
    orderedAt: '',
    paidForBy: '',
    taxCost: '',
    shippingCost: '',
    notes: '',
    reimbursed: false,
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedItem, setEditedItem] = useState({
    vendor: '',
    quantity: '',
    partNumber: '',
    description: '',
    unitCost: '',
    notes: '',
  });

  const handleStartEdit = () => {
    if (!order) return;
    setEditedOrder({
      status: order.status,
      orderedAt: order.ordered_at || '',
      paidForBy: order.paid_for_by || '',
      taxCost: String(order.tax_cost || 0),
      shippingCost: String(order.shipping_cost || 0),
      notes: order.notes || '',
      reimbursed: order.reimbursed,
    });
    setIsEditing(true);
  };

  const handleSaveOrder = async () => {
    await updateOrder.mutateAsync({
      id: orderId!,
      ...editedOrder,
      taxCost: parseFloat(editedOrder.taxCost) || 0,
      shippingCost: parseFloat(editedOrder.shippingCost) || 0,
    });
    setIsEditing(false);
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (order.order_items && order.order_items.length > 0) {
      alert("Can't delete an order with items. Delete the items first.");
      return;
    }
    if (confirm('Delete this order?')) {
      await deleteOrder.mutateAsync(orderId!);
      navigate(`/projects/${order.project_id}/orders/open`);
    }
  };

  const handleStartEditItem = (item: OrderItem) => {
    setEditingItemId(item.id);
    setEditedItem({
      vendor: order?.vendor_name || '',
      quantity: String(item.quantity),
      partNumber: item.part_number,
      description: item.description,
      unitCost: String(item.unit_cost),
      notes: item.notes,
    });
  };

  const handleSaveItem = async () => {
    if (!editingItemId) return;
    await updateOrderItem.mutateAsync({
      id: editingItemId,
      ...editedItem,
      quantity: parseInt(editedItem.quantity) || 1,
      unitCost: parseFloat(editedItem.unitCost) || 0,
    });
    setEditingItemId(null);
  };

  const handleDeleteItem = async (item: OrderItem) => {
    if (confirm(`Delete "${item.description || item.part_number}"?`)) {
      await deleteOrderItem.mutateAsync(item.id);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorDisplay error={error} />;
  if (!order) return <ErrorDisplay error="Order not found" />;

  const items = order.order_items || [];
  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const grandTotal = calculateOrderTotal(items, order.tax_cost, order.shipping_cost);

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'received', label: 'Received' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/projects/${order.project_id}/orders/${order.status}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{order.vendor_name}</h1>
          <Badge variant={order.status === 'open' ? 'warning' : order.status === 'ordered' ? 'info' : 'success'}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
        {canEdit && !isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveOrder} isLoading={updateOrder.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <Select
                  label="Status"
                  value={editedOrder.status}
                  onChange={(e) => setEditedOrder({ ...editedOrder, status: e.target.value })}
                  options={statusOptions}
                />
                <Input
                  label="Ordered Date"
                  type="date"
                  value={editedOrder.orderedAt}
                  onChange={(e) => setEditedOrder({ ...editedOrder, orderedAt: e.target.value })}
                />
                <Input
                  label="Paid For By"
                  value={editedOrder.paidForBy}
                  onChange={(e) => setEditedOrder({ ...editedOrder, paidForBy: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Tax ($)"
                    type="number"
                    step="0.01"
                    value={editedOrder.taxCost}
                    onChange={(e) => setEditedOrder({ ...editedOrder, taxCost: e.target.value })}
                  />
                  <Input
                    label="Shipping ($)"
                    type="number"
                    step="0.01"
                    value={editedOrder.shippingCost}
                    onChange={(e) => setEditedOrder({ ...editedOrder, shippingCost: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editedOrder.reimbursed}
                    onChange={(e) => setEditedOrder({ ...editedOrder, reimbursed: e.target.checked })}
                  />
                  <span className="text-sm">Reimbursed</span>
                </label>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={editedOrder.notes}
                    onChange={(e) => setEditedOrder({ ...editedOrder, notes: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Ordered Date</label>
                    <p>{order.ordered_at ? new Date(order.ordered_at).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Paid For By</label>
                    <p>{order.paid_for_by || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Tax</label>
                    <p>{formatCurrency(order.tax_cost)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Shipping</label>
                    <p>{formatCurrency(order.shipping_cost)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Reimbursed</label>
                    <p>{order.reimbursed ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                {order.notes && (
                  <div>
                    <label className="text-sm text-muted-foreground">Notes</label>
                    <p className="whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatCurrency(order.tax_cost)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping_cost)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No items in this order.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Part #</th>
                    <th className="text-left py-2 px-2 font-medium">Description</th>
                    <th className="text-right py-2 px-2 font-medium">Qty</th>
                    <th className="text-right py-2 px-2 font-medium">Unit Cost</th>
                    <th className="text-right py-2 px-2 font-medium">Total</th>
                    {canEdit && <th className="py-2 px-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      {editingItemId === item.id ? (
                        <>
                          <td className="py-2 px-2">
                            <Input
                              value={editedItem.partNumber}
                              onChange={(e) => setEditedItem({ ...editedItem, partNumber: e.target.value })}
                              className="h-8"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              value={editedItem.description}
                              onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
                              className="h-8"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              value={editedItem.quantity}
                              onChange={(e) => setEditedItem({ ...editedItem, quantity: e.target.value })}
                              className="h-8 w-20 text-right"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editedItem.unitCost}
                              onChange={(e) => setEditedItem({ ...editedItem, unitCost: e.target.value })}
                              className="h-8 w-24 text-right"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            {formatCurrency(parseInt(editedItem.quantity || '0') * parseFloat(editedItem.unitCost || '0'))}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => setEditingItemId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleSaveItem}>
                                <Save className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2 font-mono text-sm">{item.part_number || '-'}</td>
                          <td className="py-2 px-2">{item.description || '-'}</td>
                          <td className="py-2 px-2 text-right">{item.quantity}</td>
                          <td className="py-2 px-2 text-right">{formatCurrency(item.unit_cost)}</td>
                          <td className="py-2 px-2 text-right">{formatCurrency(item.quantity * item.unit_cost)}</td>
                          {canEdit && (
                            <td className="py-2 px-2">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" onClick={() => handleStartEditItem(item)}>
                                  <Pencil className="h-4 w-4" />
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
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
