// اختبار الاتصال بالخادم
const testServerConnection = async () => {
    try {
        console.log("🔍 اختبار الاتصال بالخادم...");

        const response = await fetch(
            "http://localhost:5000/api/orders/pending",
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            console.log("✅ الاتصال بالخادم نجح");
            console.log("البيانات:", data);
        } else {
            console.error("❌ فشل الاتصال بالخادم");
            console.error("الحالة:", response.status);
            console.error("النص:", response.statusText);
        }
    } catch (error) {
        console.error("❌ خطأ في الاتصال:", error.message);
    }
};

// تشغيل الاختبار
testServerConnection();
