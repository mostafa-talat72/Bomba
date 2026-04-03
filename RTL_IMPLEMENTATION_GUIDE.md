# دليل تطبيق دعم RTL في الصفحات

## استخدام useRTL Hook

### 1. الاستيراد والإعداد

```typescript
import { useRTL } from '../hooks/useRTL';

const MyPage = () => {
  const rtl = useRTL();
  
  // الآن يمكنك استخدام جميع الدوال المساعدة
};
```

### 2. تطبيق الاتجاه على الحاوية الرئيسية

```typescript
return (
  <div dir={rtl.dir} className="min-h-screen bg-gray-50 dark:bg-gray-900">
    {/* المحتوى */}
  </div>
);
```

### 3. محاذاة النصوص

```typescript
// محاذاة تلقائية حسب اللغة
<h1 className={rtl.textAlign}>
  {t('title')}
</h1>

// أو استخدام conditional
<p className={rtl.conditional('text-right', 'text-left')}>
  {t('description')}
</p>
```

### 4. Flexbox والعناصر المرنة

```typescript
// عكس اتجاه العناصر في RTL
<div className={`flex ${rtl.flexDirection} items-center gap-4`}>
  <Icon className="w-5 h-5" />
  <span>{t('label')}</span>
</div>

// أو استخدام spaceX
<div className={`flex ${rtl.flexDirection} items-center ${rtl.spaceX('4')}`}>
  <Icon className="w-5 h-5" />
  <span>{t('label')}</span>
</div>
```

### 5. المسافات (Margins & Padding)

```typescript
// Margin Left/Right
<div className={rtl.ml('4')}>  {/* ml-4 في LTR، mr-4 في RTL */}
  {t('content')}
</div>

<div className={rtl.mr('auto')}>  {/* mr-auto في LTR، ml-auto في RTL */}
  {t('content')}
</div>

// Padding Left/Right
<div className={rtl.pl('6')}>  {/* pl-6 في LTR، pr-6 في RTL */}
  {t('content')}
</div>
```

### 6. المواضع (Positioning)

```typescript
// Left/Right positioning
<div className={`absolute ${rtl.left('0')} top-0`}>
  {/* left-0 في LTR، right-0 في RTL */}
</div>

<div className={`absolute ${rtl.right('4')} top-4`}>
  {/* right-4 في LTR، left-4 في RTL */}
</div>
```

### 7. الحدود والزوايا المستديرة

```typescript
// Rounded corners
<div className={`${rtl.roundedStart}-lg`}>
  {/* rounded-l-lg في LTR، rounded-r-lg في RTL */}
</div>

// Borders
<div className={`${rtl.borderStart}-2 border-blue-500`}>
  {/* border-l-2 في LTR، border-r-2 في RTL */}
</div>
```

### 8. حقول الإدخال

```typescript
// حقل نصي عادي (يتبع اتجاه اللغة)
<input
  type="text"
  dir={rtl.inputDir()}
  className={`w-full px-4 py-2 ${rtl.inputTextAlign()}`}
  placeholder={t('name')}
/>

// البريد الإلكتروني (دائماً LTR)
<input
  type="email"
  dir={rtl.inputDir('email')}
  className={`w-full px-4 py-2 ${rtl.inputTextAlign('email')}`}
  placeholder="email@example.com"
/>

// رقم الهاتف (دائماً LTR)
<input
  type="tel"
  dir={rtl.inputDir('tel')}
  className={`w-full px-4 py-2 ${rtl.inputTextAlign('tel')}`}
  placeholder="+20 123 456 7890"
/>

// الأرقام (دائماً LTR)
<input
  type="number"
  dir={rtl.inputDir('number')}
  className={`w-full px-4 py-2 ${rtl.inputTextAlign('number')}`}
  placeholder="0"
/>
```

### 9. القوائم والجداول

```typescript
// قائمة مع أيقونات
<ul className="space-y-2">
  {items.map(item => (
    <li key={item.id} className={`flex ${rtl.flexDirection} items-center gap-3`}>
      <Icon className="w-5 h-5" />
      <span className="flex-1">{item.name}</span>
      <Badge>{item.count}</Badge>
    </li>
  ))}
</ul>

// جدول
<table dir={rtl.dir} className="w-full">
  <thead>
    <tr className={rtl.textAlign}>
      <th className={rtl.pl('4')}>{t('name')}</th>
      <th>{t('status')}</th>
      <th className={rtl.pr('4')}>{t('actions')}</th>
    </tr>
  </thead>
  <tbody>
    {/* ... */}
  </tbody>
</table>
```

### 10. البطاقات (Cards)

```typescript
<div 
  dir={rtl.dir}
  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
>
  <div className={`flex ${rtl.flexDirection} items-start gap-4`}>
    <div className="flex-shrink-0">
      <Icon className="w-12 h-12 text-blue-600" />
    </div>
    <div className="flex-1">
      <h3 className={`text-xl font-bold ${rtl.textAlign}`}>
        {t('title')}
      </h3>
      <p className={`text-gray-600 dark:text-gray-400 mt-2 ${rtl.textAlign}`}>
        {t('description')}
      </p>
    </div>
  </div>
</div>
```

### 11. النماذج (Forms)

```typescript
<form dir={rtl.dir} className="space-y-6">
  {/* حقل الاسم */}
  <div>
    <label className={`block text-sm font-medium mb-2 ${rtl.textAlign}`}>
      {t('form.name')}
    </label>
    <input
      type="text"
      dir={rtl.inputDir()}
      className={`w-full px-4 py-2 border rounded-lg ${rtl.inputTextAlign()}`}
      placeholder={t('form.namePlaceholder')}
    />
  </div>

  {/* حقل البريد الإلكتروني */}
  <div>
    <label className={`block text-sm font-medium mb-2 ${rtl.textAlign}`}>
      {t('form.email')}
    </label>
    <input
      type="email"
      dir={rtl.inputDir('email')}
      className={`w-full px-4 py-2 border rounded-lg ${rtl.inputTextAlign('email')}`}
      placeholder="email@example.com"
    />
  </div>

  {/* أزرار الإرسال */}
  <div className={`flex ${rtl.flexDirection} gap-4`}>
    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">
      {t('form.submit')}
    </button>
    <button type="button" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg">
      {t('form.cancel')}
    </button>
  </div>
</form>
```

### 12. المودالات (Modals)

```typescript
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div 
    dir={rtl.dir}
    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6"
  >
    {/* Header */}
    <div className={`flex ${rtl.flexDirection} items-center justify-between mb-6`}>
      <h2 className="text-2xl font-bold">{t('modal.title')}</h2>
      <button onClick={onClose}>
        <X className="w-6 h-6" />
      </button>
    </div>

    {/* Content */}
    <div className={rtl.textAlign}>
      {children}
    </div>

    {/* Footer */}
    <div className={`flex ${rtl.flexDirection} gap-4 mt-6`}>
      <button className="px-6 py-2 bg-blue-600 text-white rounded-lg">
        {t('modal.confirm')}
      </button>
      <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg">
        {t('modal.cancel')}
      </button>
    </div>
  </div>
</div>
```

## أمثلة كاملة

### مثال 1: صفحة Dashboard

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRTL } from '../hooks/useRTL';
import { TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';

const Dashboard = () => {
  const { t } = useTranslation();
  const rtl = useRTL();

  const stats = [
    { icon: TrendingUp, label: t('dashboard.revenue'), value: '25,000', color: 'text-blue-600' },
    { icon: Users, label: t('dashboard.users'), value: '1,234', color: 'text-green-600' },
    { icon: ShoppingCart, label: t('dashboard.orders'), value: '567', color: 'text-orange-600' },
    { icon: DollarSign, label: t('dashboard.profit'), value: '12,500', color: 'text-purple-600' },
  ];

  return (
    <div dir={rtl.dir} className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <h1 className={`text-3xl font-bold mb-8 ${rtl.textAlign}`}>
        {t('dashboard.title')}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className={`flex ${rtl.flexDirection} items-center gap-4`}>
              <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div className="flex-1">
                <p className={`text-sm text-gray-600 dark:text-gray-400 ${rtl.textAlign}`}>
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${rtl.textAlign}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
```

### مثال 2: صفحة تسجيل الدخول

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRTL } from '../hooks/useRTL';
import { Mail, Lock } from 'lucide-react';

const Login = () => {
  const { t } = useTranslation();
  const rtl = useRTL();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div dir={rtl.dir} className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h1 className={`text-3xl font-bold mb-8 ${rtl.textAlign}`}>
          {t('auth.login')}
        </h1>

        <form className="space-y-6">
          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${rtl.textAlign}`}>
              {t('auth.email')}
            </label>
            <div className={`flex ${rtl.flexDirection} items-center gap-3 border rounded-lg px-4 py-3`}>
              <Mail className="w-5 h-5 text-gray-400" />
              <input
                type="email"
                dir={rtl.inputDir('email')}
                className={`flex-1 bg-transparent outline-none ${rtl.inputTextAlign('email')}`}
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${rtl.textAlign}`}>
              {t('auth.password')}
            </label>
            <div className={`flex ${rtl.flexDirection} items-center gap-3 border rounded-lg px-4 py-3`}>
              <Lock className="w-5 h-5 text-gray-400" />
              <input
                type="password"
                dir={rtl.inputDir()}
                className={`flex-1 bg-transparent outline-none ${rtl.inputTextAlign()}`}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('auth.loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
```

## الخلاصة

باستخدام `useRTL` Hook، يمكنك بسهولة تطبيق دعم RTL/LTR في جميع صفحات التطبيق بطريقة متسقة ونظيفة. الـ Hook يوفر جميع الدوال المساعدة التي تحتاجها للتعامل مع الاتجاهات، المسافات، المحاذاة، والمواضع.
