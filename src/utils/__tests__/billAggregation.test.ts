import { describe, it, expect } from 'vitest';
import { aggregateItemsWithPayments } from '../billAggregation';

describe('billAggregation - paidQuantity support', () => {
  it('should use paidQuantity when available (new system)', () => {
    const orders = [
      {
        _id: 'order1',
        orderNumber: '001',
        items: [
          { name: 'Coffee', price: 20, quantity: 5 }
        ]
      }
    ];

    const itemPayments = [
      {
        orderId: 'order1',
        itemId: 'item1',
        itemName: 'Coffee',
        quantity: 5,
        paidQuantity: 3, // New field: 3 out of 5 paid
        pricePerUnit: 20,
        totalPrice: 100,
        paidAmount: 60,
        isPaid: false
      }
    ];

    const result = aggregateItemsWithPayments(orders, itemPayments);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Coffee');
    expect(result[0].totalQuantity).toBe(5);
    expect(result[0].paidQuantity).toBe(3);
    expect(result[0].remainingQuantity).toBe(2);
  });

  it('should fallback to isPaid for backward compatibility (old system)', () => {
    const orders = [
      {
        _id: 'order1',
        orderNumber: '001',
        items: [
          { name: 'Tea', price: 15, quantity: 3 }
        ]
      }
    ];

    const itemPayments = [
      {
        orderId: 'order1',
        itemId: 'item1',
        itemName: 'Tea',
        quantity: 3,
        // No paidQuantity field (old data)
        pricePerUnit: 15,
        totalPrice: 45,
        paidAmount: 45,
        isPaid: true // Old system: fully paid
      }
    ];

    const result = aggregateItemsWithPayments(orders, itemPayments);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tea');
    expect(result[0].totalQuantity).toBe(3);
    expect(result[0].paidQuantity).toBe(3); // Should use quantity when isPaid is true
    expect(result[0].remainingQuantity).toBe(0);
  });

  it('should handle mixed old and new data structures', () => {
    const orders = [
      {
        _id: 'order1',
        orderNumber: '001',
        items: [
          { name: 'Coffee', price: 20, quantity: 5 },
          { name: 'Tea', price: 15, quantity: 3 }
        ]
      }
    ];

    const itemPayments = [
      {
        orderId: 'order1',
        itemId: 'item1',
        itemName: 'Coffee',
        quantity: 5,
        paidQuantity: 2, // New system
        pricePerUnit: 20,
        totalPrice: 100,
        paidAmount: 40,
        isPaid: false
      },
      {
        orderId: 'order1',
        itemId: 'item2',
        itemName: 'Tea',
        quantity: 3,
        // No paidQuantity (old system)
        pricePerUnit: 15,
        totalPrice: 45,
        paidAmount: 45,
        isPaid: true
      }
    ];

    const result = aggregateItemsWithPayments(orders, itemPayments);

    expect(result).toHaveLength(2);
    
    const coffee = result.find(item => item.name === 'Coffee');
    expect(coffee?.paidQuantity).toBe(2);
    expect(coffee?.remainingQuantity).toBe(3);
    
    const tea = result.find(item => item.name === 'Tea');
    expect(tea?.paidQuantity).toBe(3);
    expect(tea?.remainingQuantity).toBe(0);
  });

  it('should handle paidQuantity of 0 correctly', () => {
    const orders = [
      {
        _id: 'order1',
        orderNumber: '001',
        items: [
          { name: 'Juice', price: 25, quantity: 4 }
        ]
      }
    ];

    const itemPayments = [
      {
        orderId: 'order1',
        itemId: 'item1',
        itemName: 'Juice',
        quantity: 4,
        paidQuantity: 0, // Nothing paid yet
        pricePerUnit: 25,
        totalPrice: 100,
        paidAmount: 0,
        isPaid: false
      }
    ];

    const result = aggregateItemsWithPayments(orders, itemPayments);

    expect(result).toHaveLength(1);
    expect(result[0].paidQuantity).toBe(0);
    expect(result[0].remainingQuantity).toBe(4);
  });

  it('should aggregate multiple payments for same item', () => {
    const orders = [
      {
        _id: 'order1',
        orderNumber: '001',
        items: [
          { name: 'Coffee', price: 20, quantity: 3 }
        ]
      },
      {
        _id: 'order2',
        orderNumber: '002',
        items: [
          { name: 'Coffee', price: 20, quantity: 2 }
        ]
      }
    ];

    const itemPayments = [
      {
        orderId: 'order1',
        itemId: 'item1',
        itemName: 'Coffee',
        quantity: 3,
        paidQuantity: 2,
        pricePerUnit: 20,
        totalPrice: 60,
        paidAmount: 40,
        isPaid: false
      },
      {
        orderId: 'order2',
        itemId: 'item2',
        itemName: 'Coffee',
        quantity: 2,
        paidQuantity: 1,
        pricePerUnit: 20,
        totalPrice: 40,
        paidAmount: 20,
        isPaid: false
      }
    ];

    const result = aggregateItemsWithPayments(orders, itemPayments);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Coffee');
    expect(result[0].totalQuantity).toBe(5); // 3 + 2
    expect(result[0].paidQuantity).toBe(3); // 2 + 1
    expect(result[0].remainingQuantity).toBe(2); // 5 - 3
  });
});
