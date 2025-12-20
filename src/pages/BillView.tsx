import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import { aggregateItemsWithPayments } from '../utils/billAggregation';
import { io } from 'socket.io-client';

interface OrderItem {
	name: string;
	price: number;
	quantity: number;
	preparedCount?: number;
	notes?: string;
	additionalPrice?: number;
	menuItem?: {
		_id: string;
		name: string;
		arabicName?: string;
		preparationTime: number;
		price: number;
	};
	addons?: {
		_id: string;
		name: string;
		price: number;
	}[];
	addonsTotal?: number;
}

interface Order {
	_id: string;
	orderNumber: string;
	customerName?: string;
	items: OrderItem[];
	status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
	totalAmount?: number;
	finalAmount?: number;
	notes?: string;
	createdAt: string;
	createdBy?: {
		_id: string;
		name: string;
	};
}

interface Session {
	_id: string;
	deviceType: string;
	deviceNumber: number;
	deviceName: string;
	deviceId?: string; // إضافة معرف الجهاز
	customerName?: string;
	startTime: string;
	endTime?: string;
	status: 'active' | 'paused' | 'completed' | 'cancelled';
	hourlyRate: number;
	totalCost: number;
	finalCost: number;
	controllers?: number;
	controllersHistory?: Array<{
		controllers: number;
		from: string;
		to?: string;
	}>;
	notes?: string;
	createdBy?: {
		_id: string;
		name: string;
	};
}

interface Payment {
	amount: number;
	method: 'cash' | 'card' | 'transfer';
	reference?: string;
	timestamp: string;
	user: {
		_id: string;
		name: string;
	};
}

interface ItemPayment {
	orderId: string;
	itemId: string;
	itemName: string;
	quantity: number;
	pricePerUnit: number;
	totalPrice: number;
	paidAmount: number;
	isPaid: boolean;
	paidAt?: string;
	paidBy?: string;
}

interface SessionPayment {
	sessionId: string;
	sessionCost: number;
	paidAmount: number;
	remainingAmount: number;
	payments: {
		amount: number;
		paidAt: string;
		paidBy: string;
		method: 'cash' | 'card' | 'transfer';
	}[];
}

interface BillDetails {
	_id: string;
	billNumber: string;
	customerName?: string;
	customerPhone?: string;
	tableNumber: number;
	orders: Order[];
	sessions: Session[];
	subtotal: number;
	discount: number;
	tax: number;
	total: number;
	paid: number;
	remaining: number;
	status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
	billType: 'cafe' | 'playstation' | 'computer';
	payments: Payment[];
	qrCode?: string;
	qrCodeUrl?: string;
	notes?: string;
	dueDate?: string;
	createdBy?: {
		_id: string;
		name: string;
	};
	createdAt: string;
	updatedAt?: string;
	// Old system (deprecated)
	partialPayments?: {
		orderNumber: string;
		totalPaid: number;
		items: {
			itemName: string;
			quantity: number;
			price: number;
		}[];
		paidAt: string;
		paymentMethod: 'cash' | 'card' | 'transfer';
	}[];
	// New system
	itemPayments?: ItemPayment[];
	sessionPayments?: SessionPayment[];
}

// تعريف مؤقت لدعم خاصية controllersHistoryBreakdown القادمة من السيرفر
interface SessionWithBreakdown extends Session {
	controllersHistoryBreakdown?: Array<{
		controllers: number;
		hours: number;
		minutes: number;
		hourlyRate: number;
		cost: number;
		from: string;
		to: string;
	}>;
}

const normalizeBillDates = (bill: Record<string, unknown>): BillDetails => ({
	...bill,
	createdAt: bill.createdAt?.toString() || '',
	updatedAt: bill.updatedAt?.toString(),
	orders: (bill.orders as Record<string, unknown>[])?.map((order: Record<string, unknown>) => ({
		...order,
		createdAt: order.createdAt?.toString() || '',
	})) || [],
	sessions: (bill.sessions as Record<string, unknown>[])?.map((session: Record<string, unknown>) => ({
		...session,
		startTime: session.startTime?.toString() || '',
		endTime: session.endTime?.toString(),
	})) || [],
	payments: (bill.payments as Record<string, unknown>[])?.map((payment: Record<string, unknown>) => ({
		...payment,
		timestamp: payment.timestamp?.toString() || '',
	})) || [],
	partialPayments: (bill.partialPayments as Record<string, unknown>[])?.map((payment: Record<string, unknown>) => ({
		...payment,
		paidAt: payment.paidAt?.toString() || '',
	})) || [],
	itemPayments: bill.itemPayments as ItemPayment[] | undefined,
	sessionPayments: bill.sessionPayments as SessionPayment[] | undefined,
} as BillDetails);

const BillView = () => {
	const { billId } = useParams<{ billId: string }>();
	const [bill, setBill] = useState<BillDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showOrdersModal, setShowOrdersModal] = useState(false);
	const [showPaymentModal, setShowPaymentModal] = useState(false);
	const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
	const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
	const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
	const [isProcessingPayment, setIsProcessingPayment] = useState(false);
	const [paymentError, setPaymentError] = useState<string | null>(null);

	// دالة لجلب سعر الساعة من الجلسة مباشرة
	function getHourlyRateFromDevice(session: Session, _controllers: number) {
		// استخدام hourlyRate من الجلسة نفسها
		return session.hourlyRate || 0;
	}

	const fetchBill = async (showLoading = true) => {

		if (!billId) {

			setError('معرف الفاتورة غير صحيح أو غير موجود. تأكد من صحة الرابط.');
			if (showLoading) setLoading(false);
			return;
		}

		if (billId.length !== 24) {

			setError('معرف الفاتورة غير صحيح أو غير موجود. تأكد من صحة الرابط.');
			if (showLoading) setLoading(false);
			return;
		}

		try {
			if (showLoading) setLoading(true);

			const response = await api.getBill(billId);

			if (response.success && response.data) {
				setBill(normalizeBillDates(response.data as unknown as Record<string, unknown>));
			} else {
				setError(response.message || 'لم يتم العثور على الفاتورة. تأكد من صحة الرابط أو أن الفاتورة لم تُحذف.');
			}
		} catch (err: unknown) {
			setError('حدث خطأ في تحميل الفاتورة. تأكد من اتصالك بالخادم أو أعد المحاولة لاحقاً.');
		} finally {
			if (showLoading) setLoading(false);
		}
	};

	useEffect(() => {
		fetchBill(true);

		let interval: number;
		function setupInterval() {
			// إذا كان هناك جلسة نشطة، حدث كل ثانية، وإلا كل 5 ثوانٍ للتحديث السريع
			if (bill && bill.sessions && bill.sessions.some(session => session.status === 'active')) {
				interval = window.setInterval(() => fetchBill(false), 1000); // كل ثانية
			} else {
				interval = window.setInterval(() => fetchBill(false), 5000); // كل 5 ثوانٍ
			}
		}

		setupInterval();

		return () => {
			if (interval) window.clearInterval(interval);
		};
		// نراقب bill.sessions حتى إذا تغيرت حالة الجلسة يعاد ضبط الـ interval
	}, [bill && bill.sessions && bill.sessions.some(session => session.status === 'active')]);

	// إضافة تأثير لمراقبة التغييرات في البيانات والدفعات الجزئية
	useEffect(() => {
		// فرض إعادة رسم المكون عند تحديث itemPayments
		if (bill?.itemPayments) {
			// تحديث فوري للبيانات
			const timer = setTimeout(() => {
				fetchBill(false);
			}, 200);
			return () => clearTimeout(timer);
		}
	}, [bill?.itemPayments?.length, bill?.paid, bill?.remaining]);

	// إضافة Socket.IO للتحديث الفوري
	useEffect(() => {
		if (!billId) return;

		// Initialize Socket.IO connection
		const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
		const socketUrl = apiUrl.replace(/\/api\/?$/, '');
		
		const socket = io(socketUrl, {
			path: '/socket.io/',
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
			autoConnect: true,
			forceNew: false,
		});

		// Listen for partial payment updates
		socket.on('partial-payment-received', (data: any) => {
			if (data.bill && (data.bill._id === billId || data.bill.id === billId)) {
				// تحديث فوري للفاتورة
				setBill(normalizeBillDates(data.bill as unknown as Record<string, unknown>));
			}
		});

		// Listen for payment updates
		socket.on('payment-received', (data: any) => {
			if (data.bill && (data.bill._id === billId || data.bill.id === billId)) {
				// تحديث فوري للفاتورة
				setBill(normalizeBillDates(data.bill as unknown as Record<string, unknown>));
			}
		});

		return () => {
			socket.off('partial-payment-received');
			socket.off('payment-received');
			socket.disconnect();
		};
	}, [billId]);

	const formatCurrency = (amount: number) => {
		return formatCurrencyUtil(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('ar-EG', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getOrderStatusText = (status: string) => {
		switch (status) {
			case 'pending': return 'في الانتظار';
			case 'preparing': return 'قيد التجهيز';
			case 'ready': return 'جاهز';
			case 'delivered': return 'تم التسليم';
			case 'cancelled': return 'ملغي';
			default: return 'غير معروف';
		}
	};

	const getOrderStatusColor = (status: string) => {
		switch (status) {
			case 'pending': return 'text-yellow-700 bg-yellow-100';
			case 'preparing': return 'text-blue-700 bg-blue-100';
			case 'ready': return 'text-green-700 bg-green-100';
			case 'delivered': return 'text-purple-700 bg-purple-100';
			case 'cancelled': return 'text-red-700 bg-red-100';
			default: return 'text-gray-600 bg-gray-100';
		}
	};

	// Note: aggregateItemsWithPayments is now imported from utils/billAggregation.ts

	// دالة لحساب إجمالي تكلفة الطلبات مع الإضافات
	function getOrdersTotal(orders: Order[]) {
		return orders.reduce((total, order) =>
			total + order.items.reduce((orderTotal, item) =>
				orderTotal + (item.price * item.quantity) + (item.addonsTotal || item.additionalPrice || 0), 0
			), 0
		);
	}

	// دالة لمعالجة الدفع الجزئي
	const handlePaymentSubmit = async () => {
		if (!bill) return;

		setIsProcessingPayment(true);
		setPaymentError(null);

		try {
			// تجميع العناصر المحددة مع الكميات
			const itemsToPayFor = aggregateItemsWithPayments(
				bill.orders || [],
				bill.itemPayments || [],
				bill.status,
				bill.paid,
				bill.total
			)
				.filter(item => {
					const addonsKey = (item.addons || [])
						.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
						.sort()
						.join('|');
					const itemKey = `${item.name}|${item.price}|${addonsKey}`;
					return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
				})
				.map(item => {
					const addonsKey = (item.addons || [])
						.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
						.sort()
						.join('|');
					const itemKey = `${item.name}|${item.price}|${addonsKey}`;
					
					// البحث عن itemId من الطلبات
					let itemId = '';
					for (const order of bill.orders) {
						const foundItem = order.items.find(
							orderItem => orderItem.name === item.name && orderItem.price === item.price
						);
						if (foundItem) {
							// استخدام اسم الصنف كـ itemId إذا لم يكن هناك _id
							itemId = (foundItem as unknown as { _id?: string })._id || item.name;
							break;
						}
					}

					return {
						itemId: itemId,
						quantity: itemQuantities[itemKey] || 0
					};
				});

			if (itemsToPayFor.length === 0) {
				setPaymentError('الرجاء اختيار عناصر للدفع');
				setIsProcessingPayment(false);
				return;
			}

			const response = await api.payForItems(bill._id, {
				items: itemsToPayFor,
				paymentMethod: paymentMethod
			});

			if (response.success) {
				// تحديث الفاتورة
				await fetchBill(false);
				
				// إعادة تعيين الحالة
				setShowPaymentModal(false);
				setSelectedItems({});
				setItemQuantities({});
				setPaymentMethod('cash');
				setPaymentError(null);
			} else {
				setPaymentError(response.message || 'حدث خطأ أثناء معالجة الدفع');
			}
		} catch (err) {
			setPaymentError('حدث خطأ أثناء معالجة الدفع');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400 mx-auto mb-4"></div>
					<p className="text-gray-600">جاري تحميل الفاتورة...</p>
				</div>
			</div>
		);
	}

	if (error || !bill) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto px-4">
					<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
					<h1 className="text-2xl font-bold text-gray-900 mb-2">خطأ في تحميل الفاتورة</h1>
					<p className="text-gray-600 mb-6">{error || 'لم يتم العثور على الفاتورة'}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-lg mx-auto px-4">
				{/* Header */}
				<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h1 className="text-2xl font-bold text-gray-900 mb-1">فاتورة #{bill.billNumber}</h1>
							<p className="text-gray-600 text-sm">{bill.customerName || 'عميل'}</p>
							<p className="text-gray-400 text-xs">{formatDate(bill.createdAt)}</p>
						</div>
						<div className="flex flex-col items-end gap-2">
							<span className={`px-3 py-1 rounded-full text-sm font-medium ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
								{bill.status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
							</span>
							{/* زر الدفع الجزئي */}
							{bill.status !== 'paid' && bill.orders && bill.orders.length > 0 && (
								<button
									className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
									onClick={() => setShowPaymentModal(true)}
								>
									دفع أصناف محددة
								</button>
							)}
							{/* زر عرض الطلبات */}
							{bill.orders && bill.orders.length > 0 && (
								<button
									className="px-3 py-1 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded text-xs"
									onClick={() => setShowOrdersModal(true)}
								>
									عرض جميع الطلبات
								</button>
							)}
						</div>
					</div>
					{/* Table of items with paid info */}
					{bill.orders && bill.orders.length > 0 && bill.orders.some(order => order.items && order.items.length > 0) && (
						<>
							<div className="overflow-x-auto">
								<table className="min-w-full text-sm text-right">
									<thead>
										<tr className="bg-gray-50">
											<th className="py-2 px-2 font-medium text-gray-700">الصنف</th>
											<th className="py-2 px-2 font-medium text-gray-700">الكمية</th>
											<th className="py-2 px-2 font-medium text-gray-700">المدفوع</th>
											<th className="py-2 px-2 font-medium text-gray-700">المتبقي</th>
											<th className="py-2 px-2 font-medium text-gray-700">السعر</th>
											<th className="py-2 px-2 font-medium text-gray-700">الإجمالي</th>
										</tr>
									</thead>
									<tbody>
										{aggregateItemsWithPayments(bill.orders, bill.itemPayments, bill.status, bill.paid, bill.total).map((item, idx) => {
											const colorClass = idx % 2 === 0 ? 'bg-white' : 'bg-blue-50';
											const totalPrice = item.price * item.totalQuantity;
											const isFullyPaid = item.remainingQuantity === 0;
											return (
												<tr key={`${item.name}-${item.price}-${idx}`} className={`border-b last:border-b-0 ${colorClass} ${isFullyPaid ? 'bg-green-50' : ''}`}>
													<td className="py-2 px-2 font-medium text-gray-900">
														{item.name}
														{isFullyPaid && <span className="mr-2 text-xs text-green-600 font-bold">✓ مدفوع بالكامل</span>}
													</td>
													<td className="py-2 px-2">{formatDecimal(item.totalQuantity)}</td>
													<td className="py-2 px-2 text-green-600 font-medium">{formatDecimal(item.paidQuantity)}</td>
													<td className="py-2 px-2 text-orange-600 font-medium">{formatDecimal(item.remainingQuantity)}</td>
													<td className="py-2 px-2">{formatCurrency(item.price)}</td>
													<td className="py-2 px-2">{formatCurrency(totalPrice)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
							{/* Orders Total */}
							<div className="mt-4 flex justify-between items-center">
								<span className="text-gray-700 font-medium">إجمالي تكلفة الطلبات:</span>
								<span className="font-bold text-orange-600 dark:text-orange-400">
									{formatCurrency(getOrdersTotal(bill.orders))}
								</span>
							</div>
						</>
					)}
					{/* Unified Sessions Details */}
					{bill.sessions && bill.sessions.length > 0 && (
						<div className="mt-6 mb-6">
							<h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
								الجلسات
								{(() => {
									const hasActiveSession = bill.sessions.some(session => session.status === 'active');

									return hasActiveSession && (
										<div className="flex items-center gap-1">
											<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
											<span className="text-sm text-red-600 font-bold">جلسة نشطة</span>
										</div>
									);
								})()}
							</h2>
							<div className="space-y-6">
								{(bill.sessions as SessionWithBreakdown[]).map((session) => {
									// Find session payment details
									const sessionPayment = bill.sessionPayments?.find(sp => sp.sessionId === session._id);
									const isSessionFullyPaid = sessionPayment && sessionPayment.remainingAmount === 0;
									
									return (
									<div key={session._id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
										<div className="flex justify-between items-center mb-2">
											<div>
												<span className="font-bold text-orange-600 dark:text-orange-400">{session.deviceName}</span>
												<span className="text-xs text-gray-500 ml-2">({session.deviceType === 'playstation' ? 'بلايستيشن' : session.deviceType === 'computer' ? 'كمبيوتر' : session.deviceType})</span>
											</div>
											<div className={`px-2 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${session.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
												{(() => {

													return session.status === 'active' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>;
												})()}
												{session.status === 'active' ? 'نشط' : 'منتهية'}
											</div>
										</div>
										<div className="flex flex-wrap gap-4 mb-2 text-sm">
											<div>
												<span className="text-gray-600">وقت البداية:</span>
												<span className="font-medium ml-1">{formatDate(session.startTime)}</span>
											</div>
											{session.endTime && (
												<div>
													<span className="text-gray-600">وقت الانتهاء:</span>
													<span className="font-medium ml-1">{formatDate(session.endTime)}</span>
												</div>
											)}
											{session.status === 'active' && (
												<div>
													<span className="text-gray-600">المدة الحالية:</span>
													<span className="font-medium text-green-600 ml-1 animate-pulse">
														{(() => {
															const now = new Date();
															const start = new Date(session.startTime);
															const diffMs = now.getTime() - start.getTime();
															const hours = Math.floor(diffMs / (1000 * 60 * 60));
															const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
															return `${formatDecimal(hours)}س ${formatDecimal(minutes)}د`;
														})()}
													</span>
												</div>
											)}
										</div>
										{/* تفاصيل الكمبيوتر */}
										{session.deviceType === 'playstation' && Array.isArray(session.controllersHistoryBreakdown) && session.controllersHistoryBreakdown.length > 0 ? (
											<div className="mb-2">
												<h4 className="font-medium text-blue-900 mb-2">التفاصيل:</h4>
												<table className="min-w-full text-xs text-right bg-blue-50 rounded">
													<thead>
														<tr>
															<th className="py-1 px-2 font-medium text-blue-900">عدد الدراعات</th>
															<th className="py-1 px-2 font-medium text-blue-900">المدة</th>
															<th className="py-1 px-2 font-medium text-blue-900">سعر الساعة</th>
															<th className="py-1 px-2 font-medium text-blue-900">التكلفة</th>
														</tr>
													</thead>
													<tbody>
														{session.controllersHistoryBreakdown.map((period, idx) => (
															<tr key={`${period.from}-${period.to}-${period.controllers}-${idx}`}>
																<td className="py-1 px-2">{formatDecimal(period.controllers)}</td>
																<td className="py-1 px-2">{(period.hours > 0 ? `${formatDecimal(period.hours)} ساعة` : '') + (period.minutes > 0 ? ` ${formatDecimal(period.minutes)} دقيقة` : '')}</td>
																<td className="py-1 px-2">{formatCurrency(period.hourlyRate)}</td>
																<td className="py-1 px-2">{formatCurrency(period.cost)}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										) : (session.deviceType === 'playstation' || session.deviceType === 'computer') ? (
											<div className="mb-2">
												<h4 className="font-medium text-blue-900 mb-2">التفاصيل:</h4>

												{/* جدول تفاصيل الجلسة */}
												<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
													<table className="min-w-full text-sm">
														<thead className="bg-gray-50">
															<tr>
																{session.deviceType === 'playstation' && (
																	<th className="py-2 px-3 text-right font-medium text-gray-700">عدد الأذرع</th>
																)}
																<th className="py-2 px-3 text-right font-medium text-gray-700">المدة</th>
																<th className="py-2 px-3 text-right font-medium text-gray-700">سعر الساعة</th>
																<th className="py-2 px-3 text-right font-medium text-gray-700">التكلفة</th>
															</tr>
														</thead>
														<tbody>
															{/* الجلسة النشطة الحالية */}
															{session.status === 'active' && (
																<tr className="bg-green-50 border-b border-green-200">
																	{session.deviceType === 'playstation' && (
																		<td className="py-3 px-3 text-right">
																			<span className="font-bold text-green-700">{formatDecimal(session.controllers || 1)}</span>
																		</td>
																	)}
																	<td className="py-3 px-3 text-right">
																		<span className="font-medium text-green-700 animate-pulse">
																			{(() => {
																				// حساب مدة الفترة الحالية فقط، وليس المدة الكاملة
																				const now = new Date();
																				let periodStart = new Date(session.startTime);

																				// إذا كان هناك controllersHistory، استخدم وقت بداية آخر فترة
																				if (session.controllersHistory && session.controllersHistory.length > 0) {
																					const lastPeriod = session.controllersHistory[session.controllersHistory.length - 1];
																					if (lastPeriod.from) {
																						periodStart = new Date(lastPeriod.from);
																					}
																				}

																				const diffMs = now.getTime() - periodStart.getTime();
																				const hours = Math.floor(diffMs / (1000 * 60 * 60));
																				const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
																				return `${formatDecimal(hours)}س ${formatDecimal(minutes)}د`;
																			})()}
																		</span>
																	</td>
																	<td className="py-3 px-3 text-right">
																		<span className="font-medium text-green-700">
																			{formatCurrency(getHourlyRateFromDevice(session, session.controllers || 1))}
																		</span>
																	</td>
																	<td className="py-3 px-3 text-right">
																		<span className="font-bold text-green-600 animate-pulse">
																			{(() => {
																				// حساب تكلفة الفترة الحالية فقط
																				const now = new Date();
																				let periodStart = new Date(session.startTime);

																				// إذا كان هناك controllersHistory، استخدم وقت بداية آخر فترة
																				if (session.controllersHistory && session.controllersHistory.length > 0) {
																					const lastPeriod = session.controllersHistory[session.controllersHistory.length - 1];
																					if (lastPeriod.from) {
																						periodStart = new Date(lastPeriod.from);
																					}
																				}

																				const diffMs = now.getTime() - periodStart.getTime();
																				const minutes = diffMs / (1000 * 60);
																				const hourlyRate = getHourlyRateFromDevice(session, session.controllers || 1);
																				const minuteRate = hourlyRate / 60;
																				const currentPeriodCost = minutes * minuteRate;

																				return formatCurrency(currentPeriodCost);
																			})()}
																		</span>
																	</td>
																</tr>
															)}
															{/* البيانات التاريخية */}
															{session.controllersHistory && session.controllersHistory.length > 0 && session.controllersHistory
																.filter((history, idx) => {
																	// إخفاء آخر فترة إذا كانت الجلسة نشطة وليس لها to
																	if (session.status === 'active' && session.controllersHistory && idx === session.controllersHistory.length - 1 && !history.to) {
																		return false;
																	}
																	return true;
																})
																.map((history, idx) => {
																	// حساب المدة والتكلفة للفترة التاريخية
																	let duration = "مدة غير محددة";
																	let cost = 0;
																	let hourlyRate = 0;

																	if (history.from && history.to) {
																		const from = new Date(history.from);
																		const to = new Date(history.to);
																		const diffMs = to.getTime() - from.getTime();
																		const hours = Math.floor(diffMs / (1000 * 60 * 60));
																		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

																		if (hours > 0 || minutes > 0) {
																			duration = `${formatDecimal(hours)}س ${formatDecimal(minutes)}د`;
																		}

																		hourlyRate = getHourlyRateFromDevice(session, history.controllers);
																		const minuteRate = hourlyRate / 60;
																		cost = (hours * 60 + minutes) * minuteRate;
																	}

																	return (
																		<tr key={`history-${idx}`} className="border-b border-gray-100">
																			{session.deviceType === 'playstation' && (
																				<td className="py-2 px-3 text-right text-gray-700">
																					{formatDecimal(history.controllers)}
																				</td>
																			)}
																			<td className="py-2 px-3 text-right text-gray-700">{duration}</td>
																			<td className="py-2 px-3 text-right text-gray-700">{formatCurrency(hourlyRate)}</td>
																			<td className="py-2 px-3 text-right text-gray-700">{formatCurrency(cost)}</td>
																		</tr>
																	);
																})}
														</tbody>
													</table>
												</div>
											</div>
										) : null}
										{/* إجمالي تكلفة الجلسة - يظهر دائماً للجلسات النشطة والمنتهية */}
										{(() => {
											// حساب التكلفة الإجمالية
											let totalCost = 0;
											const isActive = session.status === 'active';

											if (isActive) {
												// للجلسات النشطة: حساب التكلفة الحالية
												const now = new Date();
												
												// إضافة تكلفة الفترات المكتملة
												if (session.controllersHistory && session.controllersHistory.length > 0) {
													totalCost = session.controllersHistory.reduce((sum, period) => {
														if (period.from && period.to) {
															const from = new Date(period.from);
															const to = new Date(period.to);
															const diffMs = to.getTime() - from.getTime();
															const minutes = diffMs / (1000 * 60);
															const hourlyRate = getHourlyRateFromDevice(session, period.controllers);
															const minuteRate = hourlyRate / 60;
															return sum + (minutes * minuteRate);
														}
														return sum;
													}, 0);
												}

												// إضافة تكلفة الفترة الحالية
												let periodStart = new Date(session.startTime);
												if (session.controllersHistory && session.controllersHistory.length > 0) {
													const lastPeriod = session.controllersHistory[session.controllersHistory.length - 1];
													if (lastPeriod.from) {
														periodStart = new Date(lastPeriod.from);
													}
												}

												const diffMs = now.getTime() - periodStart.getTime();
												const minutes = diffMs / (1000 * 60);
												const hourlyRate = getHourlyRateFromDevice(session, session.controllers || 1);
												const minuteRate = hourlyRate / 60;
												const currentPeriodCost = minutes * minuteRate;
												totalCost += currentPeriodCost;
											} else {
												// للجلسات المنتهية: حساب التكلفة النهائية
												if (Array.isArray(session.controllersHistoryBreakdown) && session.controllersHistoryBreakdown.length > 0) {
													totalCost = session.controllersHistoryBreakdown.reduce((sum, period) => sum + period.cost, 0);
												} else if (session.controllersHistory && session.controllersHistory.length > 0) {
													totalCost = session.controllersHistory.reduce((sum, period) => {
														if (period.from && period.to) {
															const from = new Date(period.from);
															const to = new Date(period.to);
															const diffMs = to.getTime() - from.getTime();
															const minutes = diffMs / (1000 * 60);
															const hourlyRate = getHourlyRateFromDevice(session, period.controllers);
															const minuteRate = hourlyRate / 60;
															return sum + (minutes * minuteRate);
														}
														return sum;
													}, 0);
												} else {
													totalCost = session.finalCost || 0;
												}
											}

											// تطبيق التقريب: إذا >= 0.5 يقرب لأعلى، وإلا يبقى كما هو
											const hourlyRate = getHourlyRateFromDevice(session, session.controllers || 1);
											if (hourlyRate > 0) {
												const hours = totalCost / hourlyRate;
												const fractionalPart = hours - Math.floor(hours);
												
												if (fractionalPart >= 0.5) {
													totalCost = Math.ceil(totalCost);
												} else {
													totalCost = Math.round(totalCost);
												}
											}

											return (
												<div className={`flex justify-between items-center mt-3 p-3 rounded-lg border ${
													isActive 
														? 'bg-green-50 border-green-200' 
														: 'bg-orange-50 border-orange-200'
												}`}>
													<span className="text-gray-800 font-bold">
														{isActive ? 'الإجمالي الحالي:' : 'إجمالي تكلفة الجلسة:'}
													</span>
													<span className={`font-bold text-lg ${
														isActive 
															? 'text-green-600 animate-pulse' 
															: 'text-orange-600'
													}`}>
														{formatCurrency(totalCost)}
													</span>
												</div>
											);
										})()}
										
										{/* عرض تفاصيل الدفع الجزئي للجلسة */}
										{sessionPayment && sessionPayment.payments && sessionPayment.payments.length > 0 && (
											<div className="mt-4 border-t border-gray-200 pt-4">
												<h4 className="font-medium text-gray-900 mb-3">تفاصيل الدفع الجزئي:</h4>
												<div className="space-y-2 bg-blue-50 rounded-lg p-3">
													<div className="flex justify-between items-center">
														<span className="text-sm text-gray-700">التكلفة الإجمالية:</span>
														<span className="text-sm font-medium">{formatCurrency(sessionPayment.sessionCost)}</span>
													</div>
													<div className="flex justify-between items-center">
														<span className="text-sm text-gray-700">المدفوع:</span>
														<span className="text-sm font-medium text-green-600">{formatCurrency(sessionPayment.paidAmount)}</span>
													</div>
													<div className="flex justify-between items-center">
														<span className="text-sm text-gray-700">المتبقي:</span>
														<span className="text-sm font-medium text-orange-600">{formatCurrency(sessionPayment.remainingAmount)}</span>
													</div>
													{isSessionFullyPaid && (
														<div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-green-200">
															<span className="text-sm font-bold text-green-600">✓ مدفوع بالكامل</span>
														</div>
													)}
													
													{/* سجل الدفعات */}
													<div className="mt-3 pt-3 border-t border-blue-200">
														<h5 className="text-xs font-medium text-gray-700 mb-2">سجل الدفعات:</h5>
														<div className="space-y-1">
															{sessionPayment.payments.map((payment, idx) => (
																<div key={idx} className="flex justify-between items-center text-xs bg-white rounded px-2 py-1">
																	<span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
																	<span className="text-gray-500">{formatDate(payment.paidAt)}</span>
																	<span className="text-gray-600">{payment.method === 'cash' ? 'نقدي' : payment.method === 'card' ? 'بطاقة' : 'تحويل'}</span>
																</div>
															))}
														</div>
													</div>
												</div>
											</div>
										)}
									</div>
								);
								})}
							</div>
						</div>
					)}
					{/* Summary */}
					<div className="mt-6 space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-gray-600">الإجمالي:</span>
							<span className="font-medium">{formatCurrency(bill.total)}</span>
						</div>
						{bill.discount > 0 && (
							<div className="flex justify-between">
								<span className="text-gray-600">الخصم:</span>
								<span className="font-medium">{formatCurrency(bill.discount)}</span>
							</div>
						)}
						{bill.tax > 0 && (
							<div className="flex justify-between">
								<span className="text-gray-600">الضريبة:</span>
								<span className="font-medium">{formatCurrency(bill.tax)}</span>
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-gray-600">المدفوع:</span>
							<span className="font-medium">{formatCurrency(bill.paid)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-600">المتبقي:</span>
							<span className="font-medium">{formatCurrency(bill.remaining)}</span>
						</div>
						{bill.notes && (
							<div className="flex justify-between">
								<span className="text-gray-600">ملاحظات:</span>
								<span className="font-medium">{bill.notes}</span>
							</div>
						)}
					</div>

				</div>
			</div>
			{/* نافذة الطلبات */}
			{showOrdersModal && bill && Array.isArray(bill.orders) && (
				<div
					className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
					onClick={(e) => {
						// أغلق النافذة إذا تم الضغط على الخلفية فقط وليس على محتوى النافذة
						if (e.target === e.currentTarget) setShowOrdersModal(false);
					}}
				>
					<div
						className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col"
						style={{ direction: 'rtl' }}
					>
						<button
							className="absolute top-2 left-2 text-gray-400 hover:text-gray-700 text-xl font-bold z-10"
							onClick={() => setShowOrdersModal(false)}
							tabIndex={0}
						>×</button>
						<h2 className="text-xl font-bold mb-4 text-center">جميع الطلبات المرتبطة بالفاتورة</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1" style={{ maxHeight: '70vh' }}>
							{bill.orders?.map((order) => (
								<div key={order._id} className="bg-gray-50 rounded-lg shadow border p-4 flex flex-col gap-2">
									<div className="flex items-center justify-between mb-2">
										<span className="font-bold text-orange-600 dark:text-orange-400">طلب #{order.orderNumber}</span>
										<span className={`px-2 py-1 rounded text-xs font-medium ${getOrderStatusColor(order.status)}`}>{getOrderStatusText(order.status)}</span>
									</div>
									{order.customerName && <div className="text-gray-600 text-xs">{order.customerName}</div>}
									<div className="text-gray-500 text-xs mb-2">{formatDate(order.createdAt || '')}</div>
									<div>
										<span className="font-semibold text-sm">الأصناف:</span>
										<ul className="list-disc pr-4 mt-1">
											{order.items?.map((item, idx) => (
												<li key={`${item.name}-${item.price}-${idx}`} className="text-xs text-gray-700">
													{item.name} × {formatDecimal(item.quantity)} - {formatCurrency(item.price)}
												</li>
											))}
										</ul>
									</div>
									{order.notes && <div className="text-xs text-gray-500 mt-2">ملاحظات: {order.notes}</div>}
									<div className="mt-2 flex justify-between items-center">
										<span className="text-xs text-gray-600">الإجمالي: <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(order.finalAmount ?? order.totalAmount ?? 0)}</span></span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* نافذة الدفع الجزئي */}
			{showPaymentModal && bill && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<div className="p-6 border-b border-gray-200">
							<h3 className="text-lg font-semibold text-gray-900">دفع أصناف محددة - فاتورة #{bill.billNumber}</h3>
							<p className="text-sm text-gray-600 mt-1">اختر الأصناف والكميات المطلوب دفعها</p>
						</div>

						<div className="p-6">
							{/* عرض رسالة الخطأ */}
							{paymentError && (
								<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
									{paymentError}
								</div>
							)}

							<div className="mb-6">
								<h4 className="font-medium text-gray-900 mb-4">اختر الأصناف والكميات</h4>

								{(() => {
									const itemsWithRemaining = aggregateItemsWithPayments(
										bill.orders || [],
										bill.itemPayments || [],
										bill.status,
										bill.paid,
										bill.total
									).filter(item => item.remainingQuantity > 0);

									if (itemsWithRemaining.length === 0) {
										return (
											<div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
												<div className="text-4xl mb-4">✅</div>
												<h5 className="font-medium text-green-900 mb-2">جميع الأصناف مدفوعة بالكامل!</h5>
												<p className="text-green-700">لا توجد أصناف متبقية للدفع في هذه الفاتورة</p>
											</div>
										);
									}

									return itemsWithRemaining.map((item) => {
										const addonsKey = (item.addons || [])
											.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
											.sort()
											.join('|');
										const itemKey = `${item.name}|${item.price}|${addonsKey}`;

										return (
											<div key={itemKey} className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-3">
												<div className="flex items-center justify-between mb-2">
													<div className="flex items-center gap-2 font-bold text-orange-700">
														{item.name}
														{/* زر - */}
														<button
															type="button"
															className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100 text-gray-700"
															onClick={() => {
																const newQty = Math.max(0, (itemQuantities[itemKey] || 0) - 1);
																setItemQuantities({ ...itemQuantities, [itemKey]: newQty });
																setSelectedItems(prev => {
																	const updated = { ...prev };
																	if (newQty > 0) updated[itemKey] = true;
																	else delete updated[itemKey];
																	return updated;
																});
															}}
															disabled={(itemQuantities[itemKey] || 0) <= 0}
														>
															-
														</button>
														<span className="mx-2 w-6 text-center select-none font-bold text-orange-700">
															{formatDecimal(itemQuantities[itemKey] || 0)}
														</span>
														{/* زر + */}
														<button
															type="button"
															className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-lg font-bold bg-white hover:bg-gray-100 text-gray-700"
															onClick={() => {
																const newQty = Math.min(item.remainingQuantity, (itemQuantities[itemKey] || 0) + 1);
																setItemQuantities({ ...itemQuantities, [itemKey]: newQty });
																setSelectedItems(prev => ({ ...prev, [itemKey]: newQty > 0 }));
															}}
															disabled={(itemQuantities[itemKey] || 0) >= item.remainingQuantity}
														>
															+
														</button>
														{/* زر دفع الكمية بالكامل */}
														<button
															type="button"
															className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
															onClick={() => {
																setItemQuantities({ ...itemQuantities, [itemKey]: item.remainingQuantity });
																setSelectedItems(prev => ({ ...prev, [itemKey]: true }));
															}}
															disabled={(itemQuantities[itemKey] || 0) === item.remainingQuantity}
														>
															دفع الكمية بالكامل
														</button>
													</div>
													<div className="text-xs text-gray-500">{formatCurrency(item.price)}</div>
												</div>
												<div className="flex gap-4 text-sm text-gray-600">
													<div>الكمية: <span className="font-bold text-gray-900">{formatDecimal(item.totalQuantity)}</span></div>
													<div>المدفوع: <span className="text-green-700 font-bold">{formatDecimal(item.paidQuantity)}</span></div>
													<div>المتبقي: <span className="text-yellow-700 font-bold">{formatDecimal(item.remainingQuantity)}</span></div>
												</div>
												{/* عرض الإضافات */}
												{item.addons && item.addons.length > 0 && (
													<div className="mt-2 pl-4 border-r-2 border-yellow-200">
														{item.addons.map((addon, addonIdx) => (
															<div key={addonIdx} className="flex items-center gap-2 text-sm text-yellow-800">
																<span>↳ إضافة: {addon.name}</span>
																<span>({formatCurrency(addon.price)})</span>
															</div>
														))}
													</div>
												)}
											</div>
										);
									});
								})()}
							</div>

							{/* طريقة الدفع */}
							{aggregateItemsWithPayments(
								bill.orders || [],
								bill.itemPayments || [],
								bill.status,
								bill.paid,
								bill.total
							).filter(item => item.remainingQuantity > 0).length > 0 && (
								<div className="mb-6">
									<h4 className="font-medium text-gray-900 mb-4">طريقة الدفع</h4>
									<div className="grid grid-cols-3 gap-3">
										<button
											onClick={() => setPaymentMethod('cash')}
											className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
												paymentMethod === 'cash'
													? 'border-orange-500 bg-orange-50 text-orange-700'
													: 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
											}`}
										>
											<div className="text-2xl mb-1">💵</div>
											<div className="text-sm font-medium">نقداً</div>
										</button>
										<button
											onClick={() => setPaymentMethod('card')}
											className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
												paymentMethod === 'card'
													? 'border-orange-500 bg-orange-50 text-orange-700'
													: 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
											}`}
										>
											<div className="text-2xl mb-1">💳</div>
											<div className="text-sm font-medium">بطاقة</div>
										</button>
										<button
											onClick={() => setPaymentMethod('transfer')}
											className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
												paymentMethod === 'transfer'
													? 'border-orange-500 bg-orange-50 text-orange-700'
													: 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
											}`}
										>
											<div className="text-2xl mb-1">📱</div>
											<div className="text-sm font-medium">تحويل</div>
										</button>
									</div>
								</div>
							)}

							{/* ملخص الدفع */}
							{Object.keys(selectedItems).some(id => selectedItems[id]) && (
								<div className="mb-6 bg-orange-50 p-4 rounded-lg border border-orange-200">
									<h4 className="font-medium text-orange-900 mb-2">ملخص الدفع</h4>
									<div className="space-y-2">
										{aggregateItemsWithPayments(
											bill.orders || [],
											bill.itemPayments || [],
											bill.status,
											bill.paid,
											bill.total
										)
											.filter(item => {
												const addonsKey = (item.addons || [])
													.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
													.sort()
													.join('|');
												const itemKey = `${item.name}|${item.price}|${addonsKey}`;
												return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
											})
											.map((item, index) => {
												const addonsKey = (item.addons || [])
													.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
													.sort()
													.join('|');
												const itemKey = `${item.name}|${item.price}|${addonsKey}`;
												const quantity = itemQuantities[itemKey] || 0;
												return (
													<div key={index} className="flex flex-col text-sm mb-3 p-2 bg-orange-100 rounded border border-orange-200">
														<span className="text-orange-800 font-medium">
															{item.name}
															{item.addons && item.addons.length > 0 && (
																<span className="ml-2 text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
																	إضافات
																</span>
															)}
															{' '}× {formatDecimal(quantity)}
														</span>
														<span className="font-bold text-orange-900 mt-1">
															المجموع: {formatCurrency(item.price * quantity)}
														</span>
													</div>
												);
											})}
										<div className="border-t border-orange-200 pt-2 mt-2">
											<div className="flex justify-between font-medium text-orange-900">
												<span>المجموع:</span>
												<span>
													{formatCurrency(
														aggregateItemsWithPayments(
															bill.orders || [],
															bill.itemPayments || [],
															bill.status,
															bill.paid,
															bill.total
														)
															.filter(item => {
																const addonsKey = (item.addons || [])
																	.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
																	.sort()
																	.join('|');
																const itemKey = `${item.name}|${item.price}|${addonsKey}`;
																return selectedItems[itemKey] && itemQuantities[itemKey] > 0;
															})
															.reduce((sum, item) => {
																const addonsKey = (item.addons || [])
																	.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
																	.sort()
																	.join('|');
																const itemKey = `${item.name}|${item.price}|${addonsKey}`;
																const quantity = itemQuantities[itemKey] || 0;
																return sum + item.price * quantity;
															}, 0)
													)}
												</span>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="p-6 border-t border-gray-200 flex justify-between">
							<button
								onClick={() => {
									setShowPaymentModal(false);
									setSelectedItems({});
									setItemQuantities({});
									setPaymentError(null);
								}}
								className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
							>
								إلغاء
							</button>

							<button
								onClick={handlePaymentSubmit}
								disabled={
									isProcessingPayment ||
									!Object.keys(selectedItems).some(id => selectedItems[id] && (itemQuantities[id] || 0) > 0)
								}
								className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
							>
								{isProcessingPayment ? (
									<>
										<svg
											className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										جاري الدفع...
									</>
								) : (
									'تأكيد الدفع'
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default BillView;
