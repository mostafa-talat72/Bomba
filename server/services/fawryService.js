import axios from "axios";
import crypto from "crypto";

const FAWRY_MERCHANT_CODE =
    process.env.FAWRY_MERCHANT_CODE || "YOUR_MERCHANT_CODE";
const FAWRY_SECURE_KEY = process.env.FAWRY_SECURE_KEY || "YOUR_SECURE_KEY";
const FAWRY_BASE_URL =
    process.env.FAWRY_BASE_URL || "https://atfawry.fawrystaging.com";

export async function createFawryPayment({
    customerEmail,
    customerName,
    amount,
    orderId,
    description,
    returnUrl,
}) {
    // إعداد بيانات الطلب
    const paymentData = {
        merchantCode: FAWRY_MERCHANT_CODE,
        merchantRefNum: orderId,
        customerName,
        customerEmail,
        customerMobile: "",
        paymentMethod: "PAYATFAWRY",
        amount,
        description,
        currencyCode: "EGP",
        chargeItems: [
            {
                itemId: "SUBSCRIPTION",
                description,
                price: amount,
                quantity: 1,
            },
        ],
        returnUrl,
    };

    // حساب التوقيع الرقمي (signature)
    const signatureString = `${FAWRY_MERCHANT_CODE}${orderId}SUBSCRIPTION${amount}EGP${FAWRY_SECURE_KEY}`;
    paymentData.signature = crypto
        .createHash("sha256")
        .update(signatureString)
        .digest("hex");

    // إرسال الطلب إلى فوري
    const response = await axios.post(
        `${FAWRY_BASE_URL}/ECommerceWeb/Fawry/payments/charge`,
        paymentData
    );
    return response.data;
}
