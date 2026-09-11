/**
 * معلومات الفاعل للإشعارات: مَن نفّذ الإجراء ومن أي جهاز.
 * المصدر من هيدر x-device-type (يضيفه apiClient تلقائياً: mobile/desktop)،
 * وعند غيابه يُستنتج من User-Agent. لا يرمي أبداً.
 */
export function getRequestSource(req) {
  try {
    const header = String(req?.headers?.['x-device-type'] || '').toLowerCase().trim();
    if (header === 'mobile' || header === 'phone' || header === 'tablet') return 'mobile';
    if (header === 'desktop') return 'desktop';
    const ua = String(req?.headers?.['user-agent'] || '');
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini|phone/i.test(ua)) return 'mobile';
  } catch {}
  return 'desktop';
}

export function actorFromReq(req) {
  try {
    const user = req?.user;
    return {
      userId: user?._id ? String(user._id) : null,
      name: user?.name || 'مستخدم',
      source: getRequestSource(req),
    };
  } catch {
    return { userId: null, name: 'مستخدم', source: 'desktop' };
  }
}
