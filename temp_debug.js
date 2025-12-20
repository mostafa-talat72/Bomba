// ملف تشخيص مؤقت
console.log("=== DEBUGGING PARTIAL PAYMENT ===");

// محاكاة البيانات
const mockBill = {
    billNumber: "BILL-TEST",
    total: 550,
    itemPayments: [
        { itemName: "Item1", paidAmount: 50 },
        { itemName: "Item2", paidAmount: 80 },
        { itemName: "Item3", paidAmount: 70 },
        { itemName: "Item4", paidAmount: 40 },
        { itemName: "Item5", paidAmount: 40 }
    ],
    payments: [
        { amount: 100, type: 'full' },
        { amount: 50, type: 'partial' }
    ]
};

// حساب النظام الجديد
let totalPaid = 0;
const itemPaymentsTotal = mockBill.itemPayments.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
totalPaid += itemPaymentsTotal;

const fullPayments = mockBill.payments.filter(p => p.type === 'full' || (!p.type && p.type !== 'partial'));
const fullPaymentsTotal = fullPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
totalPaid += fullPaymentsTotal;

console.log("Results:", {
    itemPaymentsTotal,
    fullPaymentsTotal,
    totalCalculated: totalPaid,
    billTotal: mockBill.total,
    remaining: mockBill.total - totalPaid
});

// المشكلة المحتملة: هل يتم حساب itemPayments مرتين؟
console.log("ItemPayments details:", mockBill.itemPayments);
console.log("Payments details:", mockBill.payments);