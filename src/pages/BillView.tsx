import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Receipt, Clock, CheckCircle, AlertCircle, Package, Gamepad2, Coffee, X } from 'lucide-react';
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

const normalizeBillDates = (bill: Record<string, unknown>): BillDetails => ({
	...bill,
	createdAt: bill.createdAt?.toString(),
	updatedAt: bill.updatedAt?.toString(),
	orders: bill.orders?.map((order: Record<string, unknown>) => ({
		...order,
		createdAt: order.createdAt?.toString(),
	})) || [],
	sessions: bill.sessions?.map((session: Record<string, unknown>) => ({
		...session,
		startTime: session.startTime?.toString(),
		endTime: session.endTime?.toString(),
	})) || [],
	payments: bill.payments?.map((payment: Record<string, unknown>) => ({
		...payment,
		timestamp: payment.timestamp?.toString(),
	})) || [],
	partialPayments: bill.partialPayments?.map((payment: Record<string, unknown>) => ({
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
	const [showOrdersModal, setShowOrdersModal] = useState(false);

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
			if (!showLoading) setRefreshing(true);


			const response = await api.getBill(billId);


			if (response.success && response.data) {

				setBill(normalizeBillDates(response.data));
				setLastUpdate(new Date());
			} else {
				console.error('❌ BillView: API Error:', response.message);
				setError(response.message || 'لم يتم العثور على الفاتورة. تأكد من صحة الرابط أو أن الفاتورة لم تُحذف.');
			}
		} catch (err: unknown) {
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
	useEffect(() => {	}, [bill]);

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

	// دالة لتجميع الأصناف والإضافات مع حساب الكمية والمدفوع والمتبقي
		function aggregateItemsWithPayments(orders: Order[], partialPayments: BillDetails['partialPayments'], billStatus?: string, billPaid?: number, billTotal?: number) {
		type AggregatedAddon = {
			name: string;
			price: number;
			totalQuantity: number;
			paidQuantity: number;
			remainingQuantity: number;
		};
		type AggregatedItem = {
			name: string;
			price: number;
			totalQuantity: number;
			paidQuantity: number;
			remainingQuantity: number;
			addons?: AggregatedAddon[];
		};
		const map = new Map<string, AggregatedItem>();

		// Helper لحساب المدفوع لصنف أو إضافة
		function getPaidQty(itemName: string, addonName?: string) {
			let paid = 0;

			// إذا كانت الفاتورة مدفوعة بالكامل، جميع الأصناف مدفوعة بالكامل
			if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal) {
				// حساب الكمية الإجمالية للصنف أو الإضافة
				let totalQty = 0;
				orders.forEach(order => {
					order.items.forEach(item => {
						if (addonName) {
							// إضافة
							if (item.name === itemName && item.addons) {
								const addon = item.addons.find(a => a.name === addonName);
								if (addon) {
									totalQty += item.quantity;
								}
							}
						} else {
							// صنف رئيسي
							if (item.name === itemName) {
								totalQty += item.quantity;
							}
						}
					});
				});
				return totalQty; // جميع الكمية مدفوعة
			}

			// حساب المدفوعات الجزئية
			if (!partialPayments) return 0;
			partialPayments.forEach(payment => {
				payment.items.forEach(item => {
					if (addonName) {
						// دفع إضافة - نبحث عن الإضافة في قائمة الإضافات
						if (item.itemName === addonName) {
							paid += item.quantity;
						}
					} else {
						// دفع صنف رئيسي
						if (item.itemName === itemName) {
							paid += item.quantity;
						}
					}
				});
			});
			return paid;
		}

		if (!orders || !Array.isArray(orders)) return [];

		orders.forEach(order => {
			if (!order.items) return; // تخطي الطلبات التي لا تحتوي على أصناف
			order.items.forEach((item: OrderItem & { addons?: { name: string; price: number }[] }) => {
				// مفتاح التجميع: اسم الصنف + السعر + أسماء الإضافات وأسعارها
				const addonsKey = (item.addons || [])
					.map((a: { name: string; price: number }) => `${a.name}:${a.price}`)
					.sort()
					.join('|');
				const key = `${item.name}|${item.price}|${addonsKey}`;
				if (!map.has(key)) {
					// تجميع الإضافات
					const addons: AggregatedAddon[] = (item.addons || []).map((a: { name: string; price: number }) => {
						const paidQty = getPaidQty(item.name, a.name);
						return {
							name: a.name,
							price: a.price,
							totalQuantity: item.quantity,
							paidQuantity: paidQty,
							remainingQuantity: item.quantity - paidQty,
						};
					});
					const paidQty = getPaidQty(item.name);
					map.set(key, {
						name: item.name,
						price: item.price,
						totalQuantity: item.quantity,
						paidQuantity: paidQty,
						remainingQuantity: item.quantity - paidQty,
						addons,
					});
				} else {
					const agg = map.get(key)!;
					agg.totalQuantity += item.quantity;
					const paidQty = getPaidQty(item.name);
					agg.paidQuantity = paidQty;
					agg.remainingQuantity = agg.totalQuantity - paidQty;
					// جمع كميات الإضافات
					if (agg.addons && item.addons) {
						item.addons.forEach(addon => {
							const found = agg.addons!.find(a => a.name === addon.name && a.price === addon.price);
							const paidQtyAddon = getPaidQty(item.name, addon.name);
							if (found) {
								found.totalQuantity += item.quantity;
								found.paidQuantity = paidQtyAddon;
								found.remainingQuantity = found.totalQuantity - paidQtyAddon;
							} else {
								agg.addons!.push({
									name: addon.name,
									price: addon.price,
									totalQuantity: item.quantity,
									paidQuantity: paidQtyAddon,
									remainingQuantity: item.quantity - paidQtyAddon,
								});
							}
						});
					}
				}
			});
		});
		return Array.from(map.values());
	}

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
							{/* زر عرض الطلبات */}
							{bill.orders && bill.orders.length > 0 && (
								<button
									className="mt-2 px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
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
										{aggregateItemsWithPayments(bill.orders, bill.partialPayments, bill.status, bill.paid, bill.total).map((item, idx) => {
											const colorClass = idx % 2 === 0 ? 'bg-white' : 'bg-blue-50';
											const totalPrice = item.price * item.totalQuantity;
											return (
												<>
													<tr key={item.name + '-' + idx} className={`border-b last:border-b-0 ${colorClass} ${item.remainingQuantity === 0 ? 'bg-green-100' : ''}`}>
														<td className="py-2 px-2 font-medium text-gray-900">{item.name}</td>
														<td className="py-2 px-2">{item.totalQuantity}</td>
														<td className="py-2 px-2">{item.paidQuantity}</td>
														<td className="py-2 px-2">{item.remainingQuantity}</td>
														<td className="py-2 px-2">{formatCurrency(item.price)}</td>
														<td className="py-2 px-2">{formatCurrency(totalPrice)}</td>
													</tr>
													{/* عرض الإضافات إن وجدت */}
													{item.addons && item.addons.length > 0 && item.addons.map((addon, aidx) => (
														<tr key={item.name + '-addon-' + addon.name + '-' + aidx} className="border-b last:border-b-0 bg-yellow-50">
															<td className="py-1 px-2 pl-8 text-sm text-gray-700">↳ إضافة: {addon.name}</td>
															<td className="py-1 px-2">{addon.totalQuantity}</td>
															<td className="py-1 px-2">{addon.paidQuantity}</td>
															<td className="py-1 px-2">{addon.remainingQuantity}</td>
															<td className="py-1 px-2">{formatCurrency(addon.price)}</td>
															<td className="py-1 px-2">{formatCurrency(addon.price * addon.totalQuantity)}</td>
														</tr>
													))}
												</>
											);
										})}
									</tbody>
								</table>
							</div>
							{/* Orders Total */}
							<div className="mt-4 flex justify-between items-center">
								<span className="text-gray-700 font-medium">إجمالي تكلفة الطلبات:</span>
								<span className="font-bold text-primary-700">
									{formatCurrency(bill.orders.reduce((total, order) =>
										total + order.items.reduce((orderTotal, item) =>
											orderTotal + (item.price * item.quantity) + (item.addonsTotal || item.additionalPrice || (item.addons ? item.addons.reduce((sum, a) => sum + (a.price || 0), 0) : 0)), 0
										), 0
									))}
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
								{bill.sessions.map((session) => (
									<div key={session._id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
										<div className="flex justify-between items-center mb-2">
											<div>
												<span className="font-bold text-primary-700">{session.deviceName}</span>
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
			{/* نافذة الطلبات */}
			{showOrdersModal && (
				<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative">
						<button
							className="absolute top-2 left-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
							onClick={() => setShowOrdersModal(false)}
						>×</button>
						<h2 className="text-xl font-bold mb-4 text-center">جميع الطلبات المرتبطة بالفاتورة</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{bill.orders.map((order) => (
								<div key={order._id} className="bg-gray-50 rounded-lg shadow border p-4 flex flex-col gap-2">
									<div className="flex items-center justify-between mb-2">
										<span className="font-bold text-primary-700">طلب #{order.orderNumber}</span>
										<span className={`px-2 py-1 rounded text-xs font-medium ${getOrderStatusColor(order.status)}`}>{getOrderStatusText(order.status)}</span>
									</div>
									{order.customerName && <div className="text-gray-600 text-xs">{order.customerName}</div>}
									<div className="text-gray-500 text-xs mb-2">{formatDate(order.createdAt)}</div>
									<div>
										<span className="font-semibold text-sm">الأصناف:</span>
										<ul className="list-disc pr-4 mt-1">
											{order.items.map((item, idx) => (
												<li key={idx} className="text-xs text-gray-700">
													{item.name} × {item.quantity} - {formatCurrency(item.price)}
												</li>
											))}
										</ul>
									</div>
									{order.notes && <div className="text-xs text-gray-500 mt-2">ملاحظات: {order.notes}</div>}
									<div className="mt-2 flex justify-between items-center">
										<span className="text-xs text-gray-600">الإجمالي: <span className="font-bold text-primary-700">{formatCurrency(order.finalAmount ?? order.totalAmount ?? 0)}</span></span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default BillView;
