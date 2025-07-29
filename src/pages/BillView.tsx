import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

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
	const [showOrdersModal, setShowOrdersModal] = useState(false);
	const [devices, setDevices] = useState<any[]>([]);

	// جلب الأجهزة عند تحميل الصفحة
	useEffect(() => {
		async function fetchDevices() {
			console.log('🔄 جاري تحميل الأجهزة...');
			const res = await api.getDevices({});
			if (res.success && res.data) {
				console.log('✅ تم تحميل الأجهزة:', res.data);
				setDevices(res.data);
			} else {
				console.error('❌ فشل في تحميل الأجهزة:', res.message);
			}
		}
		fetchDevices();
	}, []);

	// دالة لجلب الجهاز المناسب
	function getDeviceForSession(session: any) {
		// إذا كان هناك معرف الجهاز، استخدمه للمطابقة
		if (session.deviceId) {
			const device = devices.find(d => d._id === session.deviceId);
			console.log(`🔍 البحث عن الجهاز: deviceId=${session.deviceId}`);
			console.log(`📱 الجهاز المطابق:`, device);
			return device;
		}

		// إذا كان هناك منظمة مرتبطة بالجهاز (fallback)
		if (session.organization) {
			const device = devices.find(
				d => d.deviceNumber === session.deviceNumber && d.organization === session.organization
			);
			console.log(`🔍 البحث عن الجهاز: deviceNumber=${session.deviceNumber}, organization=${session.organization}`);
			console.log(`📱 الجهاز المطابق:`, device);
			return device;
		}

		// بدون منظمة (fallback)
		const device = devices.find(d => d.deviceNumber === session.deviceNumber);
		console.log(`🔍 البحث عن الجهاز: deviceNumber=${session.deviceNumber} (بدون منظمة)`);
		console.log(`📱 الجهاز المطابق:`, device);
		return device;
	}

	// دالة لجلب سعر الساعة الصحيح
	function getHourlyRateFromDevice(session: any, controllers: number) {
		const device = getDeviceForSession(session);
		if (!device) {
			console.log(`❌ لم يتم العثور على الجهاز للجلسة: deviceNumber=${session.deviceNumber}`);
			return 0;
		}

		let hourlyRate = 0;
		if (session.deviceType === 'playstation' && device.playstationRates) {
			hourlyRate = device.playstationRates[controllers] || 0;
			console.log(`🎮 سعر البلايستيشن: controllers=${controllers}, rate=${hourlyRate}`);
		} else {
			hourlyRate = device.hourlyRate || 0;
			console.log(`💻 سعر الكمبيوتر: rate=${hourlyRate}`);
		}

		console.log(`💰 السعر النهائي: ${hourlyRate}`);
		return hourlyRate;
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

			console.log('🔄 جاري تحميل الفاتورة...');
			const response = await api.getBill(billId);

			if (response.success && response.data) {
				console.log('✅ تم تحميل الفاتورة:', response.data);
				console.log('📋 الجلسات في الفاتورة:', response.data.sessions);
				setBill(normalizeBillDates(response.data));
			} else {
				console.error('❌ BillView: API Error:', response.message);
				setError(response.message || 'لم يتم العثور على الفاتورة. تأكد من صحة الرابط أو أن الفاتورة لم تُحذف.');
			}
		} catch (err: unknown) {
			console.error('❌ BillView: Fetch Error:', err);
			setError('حدث خطأ في تحميل الفاتورة. تأكد من اتصالك بالخادم أو أعد المحاولة لاحقاً.');
		} finally {
			if (showLoading) setLoading(false);
		}
	};

	useEffect(() => {
		fetchBill(true);

		let interval: number;
		function setupInterval() {
			// إذا كان هناك جلسة نشطة، حدث كل ثانية، وإلا كل 10 ثوانٍ
			if (bill && bill.sessions && bill.sessions.some(session => session.status === 'active')) {
				interval = window.setInterval(() => fetchBill(false), 1000); // كل ثانية
			} else {
				interval = window.setInterval(() => fetchBill(false), 10000); // كل 10 ثوانٍ
			}
		}

		setupInterval();

		return () => {
			if (interval) window.clearInterval(interval);
		};
		// نراقب bill.sessions حتى إذا تغيرت حالة الجلسة يعاد ضبط الـ interval
	}, [bill && bill.sessions && bill.sessions.some(session => session.status === 'active')]);

	// إضافة تأثير لمراقبة التغييرات في البيانات
	useEffect(() => {	}, [bill]);

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

	// دالة لتجميع الأصناف عبر جميع الطلبات مع احتساب الكمية والمدفوع والمتبقي
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

		function getPaidQty(itemName: string, itemPrice: number) {
			let paid = 0;
			if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal) {
				let totalQty = 0;
				orders.forEach(order => {
					order.items.forEach(item => {
						if (item.name === itemName && item.price === itemPrice) {
							totalQty += item.quantity;
						}
					});
				});
				return totalQty;
			}
			if (!partialPayments) return 0;
			partialPayments.forEach(payment => {
				payment.items.forEach(item => {
					if (item.itemName === itemName && item.price === itemPrice) {
						paid += item.quantity;
					}
				});
			});
			return paid;
		}

		if (!orders || !Array.isArray(orders)) return [];

		orders.forEach(order => {
			if (!order.items) return;
			order.items.forEach((item: OrderItem) => {
				const key = `${item.name}|${item.price}`;
				if (!map.has(key)) {
					const paidQty = getPaidQty(item.name, item.price);
					map.set(key, {
						name: item.name,
						price: item.price,
						totalQuantity: item.quantity,
						paidQuantity: paidQty,
						remainingQuantity: item.quantity - paidQty,
					});
				} else {
					const agg = map.get(key)!;
					agg.totalQuantity += item.quantity;
					// إعادة احتساب paid/remaining بعد جمع الكميات
					agg.paidQuantity = getPaidQty(item.name, item.price);
					agg.remainingQuantity = agg.totalQuantity - agg.paidQuantity;
				}
			});
		});
		return Array.from(map.values());
	}

	// دالة لحساب إجمالي تكلفة الطلبات مع الإضافات
	function getOrdersTotal(orders: Order[]) {
		return orders.reduce((total, order) =>
			total + order.items.reduce((orderTotal, item) =>
				orderTotal + (item.price * item.quantity) + (item.addonsTotal || item.additionalPrice || 0), 0
			), 0
		);
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
												<tr key={`${item.name}-${item.price}-${idx}`} className={`border-b last:border-b-0 ${colorClass} ${item.remainingQuantity === 0 ? 'bg-green-100' : ''}`}>
													<td className="py-2 px-2 font-medium text-gray-900">{item.name}</td>
													<td className="py-2 px-2">{formatDecimal(item.totalQuantity)}</td>
													<td className="py-2 px-2">{formatDecimal(item.paidQuantity)}</td>
													<td className="py-2 px-2">{formatDecimal(item.remainingQuantity)}</td>
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
								<span className="font-bold text-primary-700">
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
								{(bill.sessions as SessionWithBreakdown[]).map((session) => (
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
																	if (session.status === 'active' && idx === session.controllersHistory.length - 1 && !history.to) {
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
										{/* إجمالي تكلفة الجلسة - تظهر فقط بعد انتهاء الجلسة */}
										{session.status !== 'active' && (
											<div className="flex justify-between items-center mt-2">
												<span className="text-gray-700 font-medium">إجمالي تكلفة الجلسة:</span>
												<span className="font-bold text-primary-700">
													{(() => {
														// حساب التكلفة الإجمالية من البيانات التفصيلية
														let totalCost = 0;

														// إذا كان هناك controllersHistoryBreakdown، استخدمه
														if (Array.isArray(session.controllersHistoryBreakdown) && session.controllersHistoryBreakdown.length > 0) {
															totalCost = session.controllersHistoryBreakdown.reduce((sum, period) => sum + period.cost, 0);
														}
														// وإلا استخدم controllersHistory لحساب التكلفة
														else if (session.controllersHistory && session.controllersHistory.length > 0) {
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
														// وإلا استخدم session.finalCost
														else {
															totalCost = session.finalCost || 0;
														}

														return formatCurrency(totalCost);
													})()}
												</span>
											</div>
										)}
										{/* عرض التكلفة الحالية للجلسات النشطة */}
										{session.status === 'active' && (() => {
											// حساب التكلفة الحالية للجلسة النشطة
											const now = new Date();
											let totalCurrentCost = 0;

											// إضافة تكلفة الفترات المكتملة
											if (session.controllersHistory && session.controllersHistory.length > 0) {
												totalCurrentCost = session.controllersHistory.reduce((sum, period) => {
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

											const finalCurrentCost = totalCurrentCost + currentPeriodCost;

											// تظهر فقط إذا كانت التكلفة أكبر من 0
											return finalCurrentCost > 0 ? (
												<div className="flex justify-between items-center mt-2">
													<span className="text-gray-600 text-sm">التكلفة الحالية:</span>
													<div className="flex items-center gap-2">
														<span className="text-sm font-medium text-green-600 animate-pulse">
															{formatCurrency(finalCurrentCost)}
														</span>
														<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
													</div>
												</div>
											) : null;
										})()}
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
										<span className="font-bold text-primary-700">طلب #{order.orderNumber}</span>
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
