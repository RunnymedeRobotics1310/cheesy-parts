import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Calculate order total
export function calculateOrderTotal(
  items: { quantity: number; unit_cost: number }[],
  taxCost = 0,
  shippingCost = 0
): number {
  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  return itemsTotal + taxCost + shippingCost;
}
