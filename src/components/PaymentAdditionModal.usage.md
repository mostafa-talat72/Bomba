# PaymentAdditionModal Component

## Overview
A modal component for adding partial payments to cost entries. Displays current payment status and allows users to add new payments with validation.

## Features
- Display cost information (description, total amount, paid amount, remaining amount)
- Input field for payment amount with validation
- Quick action to pay full remaining amount
- Payment method selection
- Prevents payment exceeding remaining amount
- Real-time error handling

## Props

```typescript
interface PaymentAdditionModalProps {
  isOpen: boolean;              // Controls modal visibility
  onClose: () => void;          // Callback when modal is closed
  onSave: (paymentAmount: number, paymentMethod: string) => Promise<void>;  // Callback to save payment
  cost: Cost | null;            // The cost entry to add payment to
}
```

## Usage Example

```tsx
import PaymentAdditionModal from '../components/PaymentAdditionModal';

const MyComponent = () => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCost, setSelectedCost] = useState<Cost | null>(null);

  const handleAddPayment = async (paymentAmount: number, paymentMethod: string) => {
    try {
      await api.post(`/costs/${selectedCost._id}/payment`, {
        paymentAmount,
        paymentMethod,
      });
      showNotification('تم إضافة الدفعة بنجاح', 'success');
      fetchCosts();
    } catch (error) {
      throw error; // Let modal handle the error
    }
  };

  return (
    <>
      <button onClick={() => {
        setSelectedCost(someCost);
        setShowPaymentModal(true);
      }}>
        إضافة دفعة
      </button>

      <PaymentAdditionModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedCost(null);
        }}
        onSave={handleAddPayment}
        cost={selectedCost}
      />
    </>
  );
};
```

## Validation Rules
- Payment amount must be greater than 0
- Payment amount cannot exceed remaining amount
- Payment amount is required

## Payment Methods
- نقدي (cash)
- بطاقة (card)
- تحويل (transfer)
- شيك (check)

## Implementation Notes
- Form resets when modal opens
- Displays cost details in a summary card
- Shows remaining amount prominently
- Provides quick action to pay full remaining amount
- Handles loading states during submission
- Displays error messages inline
- Supports RTL layout
