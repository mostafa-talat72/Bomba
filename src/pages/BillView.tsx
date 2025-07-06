import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Receipt, Clock, User, DollarSign, CheckCircle, AlertCircle, Package, Gamepad2, Coffee, X, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

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
}

const normalizeBillDates = (bill: any): BillDetails => ({
	...bill,
	createdAt: bill.createdAt?.toString(),
	updatedAt: bill.updatedAt?.toString(),
	orders: bill.orders?.map((order: any) => ({
		...order,
		createdAt: order.createdAt?.toString(),
	})) || [],
	sessions: bill.sessions?.map((session: any) => ({
		...session,
		startTime: session.startTime?.toString(),
		endTime: session.endTime?.toString(),
	})) || [],
	payments: bill.payments?.map((payment: any) => ({
		...payment,
		timestamp: payment.timestamp?.toString(),
	})) || [],
	partialPayments: bill.partialPayments?.map((payment: any) => ({
		...payment,
		paidAt: payment.paidAt?.toString(),
	})) || [],
});

const BillView = () => {
	const { billId } = useParams<{ billId: string }>();
	const [bill, setBill] = useState<BillDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

	const fetchBill = async (showLoading = true) => {
		console.log('🔍 BillView: Starting fetch process');
		console.log('🔍 BillView: billId =', billId);
		console.log('🔍 BillView: billId length =', billId?.length);

		if (!billId) {
			console.log('❌ BillView: No billId provided');
			setError('معرف الفاتورة غير صحيح أو غير موجود. تأكد من صحة الرابط.');
			if (showLoading) setLoading(false);
			return;
		}

		if (billId.length !== 24) {
			console.log('❌ BillView: Invalid billId length. Expected 24, got', billId.length);
			setError('معرف الفاتورة غير صحيح أو غير موجود. تأكد من صحة الرابط.');
			if (showLoading) setLoading(false);
			return;
		}

		try {
			if (showLoading) setLoading(true);
			if (!showLoading) setRefreshing(true);

			console.log('🔍 BillView: Fetching bill with ID:', billId);
			const response = await api.getBill(billId);
			console.log('📥 BillView: API response:', response);

			if (response.success && response.data) {
				console.log('✅ BillView: Bill data received successfully:', response.data);
				console.log('📋 BillView: Orders data:', response.data.orders);
				if (response.data.orders) {
					response.data.orders.forEach((order: any, index: number) => {
						console.log(`📋 BillView: Order ${index + 1}:`, {
							orderNumber: order.orderNumber,
							status: order.status,
							items: order.items?.map((item: any) => ({
								name: item.name,
								quantity: item.quantity,
								preparedCount: item.preparedCount,
								isReady: item.isReady,
								preparedCountType: typeof item.preparedCount,
								preparedCountDefined: item.preparedCount !== undefined
							}))
						});
					});
				}
				setBill(normalizeBillDates(response.data));
				setLastUpdate(new Date());
			} else {
				console.error('❌ BillView: API Error:', response.message);
				setError(response.message || 'لم يتم العثور على الفاتورة. تأكد من صحة الرابط أو أن الفاتورة لم تُحذف.');
			}
		} catch (err: any) {
			console.error('❌ BillView: Fetch Error:', err);
			setError('حدث خطأ في تحميل الفاتورة. تأكد من اتصالك بالخادم أو أعد المحاولة لاحقاً.');
		} finally {
			if (showLoading) setLoading(false);
			if (!showLoading) setRefreshing(false);
		}
	};

	useEffect(() => {
		fetchBill(true);

		// تحديث تلقائي كل 30 ثانية
		const interval = setInterval(() => fetchBill(false), 30000);

		return () => clearInterval(interval);
	}, [billId]);

	// إضافة تأثير لمراقبة التغييرات في البيانات
	useEffect(() => {
		if (bill) {
			console.log('📊 BillView: Bill data updated:', {
				billNumber: bill.billNumber,
				ordersCount: bill.orders?.length || 0,
				ordersStatus: bill.orders?.map(order => ({
					orderNumber: order.orderNumber,
					status: order.status,
					itemsWithPreparedCount: order.items?.filter(item => item.preparedCount !== undefined).length || 0,
					totalItems: order.items?.length || 0
				}))
			});

			// Log detailed item information
			bill.orders?.forEach((order, orderIndex) => {
				console.log(`📊 Order ${orderIndex + 1} (${order.orderNumber}) items:`,
					order.items?.map((item, itemIndex) => ({
						index: itemIndex,
						name: item.name,
						quantity: item.quantity,
						preparedCount: item.preparedCount,
						preparedCountDefined: item.preparedCount !== undefined,
						preparedCountType: typeof item.preparedCount
					}))
				);
			});
		}
	}, [bill]);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('ar-EG', {
			style: 'currency',
			currency: 'EGP'
		}).format(amount);
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

	const getStatusText = (status: string) => {
		switch (status) {
			case 'draft': return 'مسودة';
			case 'partial': return 'مدفوع جزئياً';
			case 'paid': return 'مدفوع بالكامل';
			case 'overdue': return 'متأخر';
			case 'cancelled': return 'ملغية';
			default: return 'غير معروف';
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'draft': return 'text-gray-600 bg-gray-100';
			case 'partial': return 'text-yellow-700 bg-yellow-100';
			case 'paid': return 'text-green-700 bg-green-100';
			case 'overdue': return 'text-red-700 bg-red-100';
			case 'cancelled': return 'text-red-700 bg-red-100';
			default: return 'text-gray-600 bg-gray-100';
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'draft': return <Clock className="h-5 w-5" />;
			case 'partial': return <AlertCircle className="h-5 w-5" />;
			case 'paid': return <CheckCircle className="h-5 w-5" />;
			case 'overdue': return <AlertCircle className="h-5 w-5" />;
			case 'cancelled': return <X className="h-5 w-5" />;
			default: return <Clock className="h-5 w-5" />;
		}
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

	const getOrderStatusIcon = (status: string) => {
		switch (status) {
			case 'pending': return <Clock className="h-4 w-4" />;
			case 'preparing': return <Package className="h-4 w-4" />;
			case 'ready': return <CheckCircle className="h-4 w-4" />;
			case 'delivered': return <CheckCircle className="h-4 w-4" />;
			case 'cancelled': return <X className="h-4 w-4" />;
			default: return <Clock className="h-4 w-4" />;
		}
	};

	const getBillTypeIcon = (billType: string) => {
		switch (billType) {
			case 'cafe': return <Coffee className="h-5 w-5" />;
			case 'playstation': return <Gamepad2 className="h-5 w-5" />;
			case 'computer': return <Package className="h-5 w-5" />;
			default: return <Receipt className="h-5 w-5" />;
		}
	};

	const getBillTypeText = (billType: string) => {
		switch (billType) {
			case 'cafe': return 'كافيه';
			case 'playstation': return 'بلايستيشن';
			case 'computer': return 'كمبيوتر';
			default: return 'عام';
		}
	};

	const getCustomerDisplay = (bill: BillDetails) => {
		if (bill.billType === 'playstation') {
			return `عميل بلايستيشن (${bill.tableNumber})`;
		} else if (bill.billType === 'computer') {
			return `عميل كمبيوتر (${bill.tableNumber})`;
		} else if (bill.billType === 'cafe') {
			return bill.customerName || 'عميل كافيه';
		} else {
			return bill.customerName || 'عميل';
		}
	};

	// Helper: حساب الكمية المدفوعة لكل صنف في كل طلب
	const getPaidQuantityForItem = (orderNumber: string, itemName: string): number => {
		if (!bill?.partialPayments) return 0;
		let paid = 0;
		bill.partialPayments.forEach(payment => {
			if (payment.orderNumber === orderNumber) {
				payment.items.forEach(item => {
					if (item.itemName === itemName) {
						paid += item.quantity;
					}
				});
			}
		});
		return paid;
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
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
						<div className="flex flex-col items-end">
							<span className={`px-3 py-1 rounded-full text-sm font-medium ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
								{bill.status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
							</span>
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
										{bill.orders?.flatMap(order =>
											order.items.map((item, idx) => {
												const paidQty = getPaidQuantityForItem(order.orderNumber, item.name);
												const remainingQty = (item.quantity || 0) - paidQty;
												const isFullyPaid = paidQty >= (item.quantity || 0);
												return (
													<tr key={order._id + '-' + idx} className={`border-b last:border-b-0 ${isFullyPaid ? 'bg-green-50' : ''}`}>
														<td className="py-2 px-2 font-medium">{item.name}</td>
														<td className="py-2 px-2">{item.quantity}</td>
														<td className="py-2 px-2 text-green-700 font-bold">{paidQty > 0 ? paidQty : '-'}</td>
														<td className="py-2 px-2 text-yellow-700">{remainingQty > 0 ? remainingQty : '-'}</td>
														<td className="py-2 px-2">{formatCurrency(item.price)}</td>
														<td className="py-2 px-2 font-bold">{formatCurrency(item.price * item.quantity)}</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
							{/* Orders Total */}
							<div className="mt-4 flex justify-between items-center">
								<span className="text-gray-700 font-medium">إجمالي تكلفة الطلبات:</span>
								<span className="font-bold text-primary-700">
									{formatCurrency(bill.orders.reduce((total, order) =>
										total + order.items.reduce((orderTotal, item) =>
											orderTotal + (item.price * item.quantity), 0
										), 0
									))}
								</span>
							</div>
						</>
					)}
					{/* Unified Sessions Details */}
					{bill.sessions && bill.sessions.length > 0 && (
						<div className="mt-6 mb-6">
							<h2 className="text-lg font-semibold text-gray-900 mb-4">الجلسات</h2>
							<div className="space-y-6">
								{bill.sessions.map((session) => (
									<div key={session._id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
										<div className="flex justify-between items-center mb-2">
											<div>
												<span className="font-bold text-primary-700">{session.deviceName}</span>
												<span className="text-xs text-gray-500 ml-2">({session.deviceType === 'playstation' ? 'بلايستيشن' : session.deviceType === 'computer' ? 'كمبيوتر' : session.deviceType})</span>
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
										</div>
										{/* تفاصيل الكمبيوتر */}
										{session.deviceType === 'computer' && (
											<div className="mb-2">
												<h4 className="font-medium text-blue-900 mb-2">تفاصيل الجلسة:</h4>
												<table className="min-w-full text-xs text-right bg-blue-50 rounded">
													<thead>
														<tr>
															<th className="py-1 px-2 font-medium text-blue-900">المدة</th>
															<th className="py-1 px-2 font-medium text-blue-900">التكلفة</th>
														</tr>
													</thead>
													<tbody>
														<tr>
															<td className="py-1 px-2">
																{(() => {
																	const start = new Date(session.startTime);
																	const end = session.endTime ? new Date(session.endTime) : new Date();
																	const durationMs = end.getTime() - start.getTime();
																	const hours = Math.floor(durationMs / (1000 * 60 * 60));
																	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
																	return `${hours > 0 ? hours + ' ساعة' : ''} ${minutes > 0 ? minutes + ' دقيقة' : ''}`;
																})()}
															</td>
															<td className="py-1 px-2">{formatCurrency(session.finalCost)}</td>
														</tr>
													</tbody>
												</table>
											</div>
										)}
										{/* تفاصيل الدواسات للبلايستيشن */}
										{session.deviceType === 'playstation' && session.controllersHistory && session.controllersHistory.length > 0 && (
											<div className="mb-2">
												<h4 className="font-medium text-blue-900 mb-2">تفاصيل الساعات حسب عدد الدراعات:</h4>
												<table className="min-w-full text-xs text-right bg-blue-50 rounded">
													<thead>
														<tr>
															<th className="py-1 px-2 font-medium text-blue-900">عدد الدراعات</th>
															<th className="py-1 px-2 font-medium text-blue-900">المدة</th>
															<th className="py-1 px-2 font-medium text-blue-900">التكلفة</th>
														</tr>
													</thead>
													<tbody>
														{session.controllersHistory.map((period, index) => {
															const startTime = new Date(period.from);
															const endTime = period.to ? new Date(period.to) : new Date();
															const durationMs = endTime.getTime() - startTime.getTime();
															const hours = Math.floor(durationMs / (1000 * 60 * 60));
															const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
															let rate = 20;
															if (period.controllers === 3) rate = 25;
															if (period.controllers >= 4) rate = 30;
															const cost = ((durationMs / (1000 * 60 * 60)) * rate);
															return (
																<tr key={index}>
																	<td className="py-1 px-2">{period.controllers}</td>
																	<td className="py-1 px-2">{hours > 0 ? `${hours} ساعة` : ''} {minutes > 0 ? `${minutes} دقيقة` : ''}</td>
																	<td className="py-1 px-2">{formatCurrency(cost)}</td>
																</tr>
															);
														})}
													</tbody>
												</table>
											</div>
										)}
										<div className="flex justify-between items-center mt-2">
											<span className="text-gray-700 font-medium">إجمالي تكلفة الجلسة:</span>
											<span className="font-bold text-primary-700">{formatCurrency(session.finalCost)}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
					{/* Summary */}
					<div className="mt-6 space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-gray-600">الإجمالي:</span>
							<span className="font-medium">{formatCurrency(bill.total)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-600">المدفوع:</span>
							<span className="font-medium">{formatCurrency(bill.paid)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-gray-600">المتبقي:</span>
							<span className="font-medium">{formatCurrency(bill.remaining)}</span>
						</div>

					</div>
				</div>
			</div>
		</div>
	);
};

export default BillView;
