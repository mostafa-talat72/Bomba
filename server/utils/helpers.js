import moment from 'moment';

// Format currency
export const formatCurrency = (amount, currency = 'EGP') => {
  const formatter = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

// Calculate date range
export const getDateRange = (filter) => {
  const now = moment();
  let startDate, endDate;

  // Handle old string-based period for backward compatibility
  if (typeof filter === 'string') {
    switch (filter) {
      case 'today':
        startDate = now.clone().startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case 'yesterday':
        startDate = now.clone().subtract(1, 'day').startOf('day');
        endDate = now.clone().subtract(1, 'day').endOf('day');
        break;
      case 'week':
        startDate = now.clone().startOf('week');
        endDate = now.clone().endOf('week');
        break;
      case 'month':
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        break;
      case 'quarter':
        startDate = now.clone().startOf('quarter');
        endDate = now.clone().endOf('quarter');
        break;
      case 'year':
        startDate = now.clone().startOf('year');
        endDate = now.clone().endOf('year');
        break;
      default:
        startDate = now.clone().startOf('day');
        endDate = now.clone().endOf('day');
    }
  } else if (typeof filter === 'object' && filter !== null) {
    const { type, day, month, year, period } = filter;

    if (period) {
      return getDateRange(period); // Recursive call for simple period
    }

    switch (type) {
      case 'daily':
        if (day) {
          const date = moment(day, 'YYYY-MM-DD');
          startDate = date.clone().startOf('day');
          endDate = date.clone().endOf('day');
        }
        break;
      case 'monthly':
        if (month) {
          const date = moment(month, 'YYYY-MM');
          startDate = date.clone().startOf('month');
          endDate = date.clone().endOf('month');
        }
        break;
      case 'yearly':
        if (year) {
          const date = moment(year, 'YYYY');
          startDate = date.clone().startOf('year');
          endDate = date.clone().endOf('year');
        }
        break;
      default:
        // Default to today if type is unknown or not provided
        startDate = now.clone().startOf('day');
        endDate = now.clone().endOf('day');
        break;
    }
  }

  // Fallback to today if no valid filter was applied
  if (!startDate || !endDate) {
    startDate = now.clone().startOf('day');
    endDate = now.clone().endOf('day');
  }

  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate()
  };
};

// Generate unique code
export const generateUniqueCode = (prefix = '', length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Calculate pagination
export const getPagination = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit: parseInt(limit) };
};

// Format response
export const formatResponse = (success, message, data = null, meta = null) => {
  const response = { success, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return response;
};

// Calculate session duration
export const calculateSessionDuration = (startTime, endTime = null) => {
  const end = endTime || new Date();
  const duration = moment(end).diff(moment(startTime), 'minutes');
  return Math.max(0, duration);
};

// Calculate session cost
export const calculateSessionCost = (session) => {
  const duration = calculateSessionDuration(session.startTime, session.endTime);
  const hours = Math.ceil(duration / 60);
  
  if (session.device === 'computer') {
    return hours * 20;
  } else if (session.device === 'playstation') {
    if (session.controllerChanges && session.controllerChanges.length > 0) {
      let totalCost = 0;
      session.controllerChanges.forEach(change => {
        const baseRate = 15;
        const additionalRate = (change.controllers - 1) * 5;
        const changeHours = Math.ceil(change.duration / 60);
        totalCost += changeHours * (baseRate + additionalRate);
      });
      return totalCost;
    } else {
      const baseRate = 15;
      const additionalRate = (session.controllers - 1) * 5;
      return hours * (baseRate + additionalRate);
    }
  }
  
  return 0;
};

// Validate Arabic text
export const isArabicText = (text) => {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
};

// Clean and validate phone number
export const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Egyptian phone number validation
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return cleaned;
  } else if (cleaned.length === 13 && cleaned.startsWith('201')) {
    return cleaned.substring(2);
  }
  
  return null;
};

// Generate QR code data
export const generateQRData = (type, data) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  switch (type) {
    case 'bill':
      return {
        type: 'bill',
        billId: data.id,
        billNumber: data.billNumber,
        total: data.total,
        url: `${baseUrl}/bill/${data.id}`
      };
    case 'menu':
      return {
        type: 'menu',
        url: `${baseUrl}/menu`
      };
    default:
      return { url: baseUrl };
  }
};