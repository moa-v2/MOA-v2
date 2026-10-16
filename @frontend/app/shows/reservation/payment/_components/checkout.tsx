'use client';

import { ANONYMOUS, loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { useEffect, useMemo, useState } from 'react';

const CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

type CheckoutProps = {
  orderId: string;
  orderName: string;
  amountValue: number;
  customerName: string;
  customerEmail: string;
  customerMobilePhone: string;
};

export default function CheckoutPage({
  orderId,
  orderName,
  amountValue,
  customerName,
  customerEmail,
  customerMobilePhone,
}: CheckoutProps) {
  const [ready, setReady] = useState(false);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [amount, setAmount] = useState({
    currency: 'KRW',
    value: amountValue,
  });

  const customerKey = useMemo(() => orderId || ANONYMOUS, [orderId]);

  useEffect(() => {
    async function fetchPaymentWidgets() {
      const tossPayments = await loadTossPayments(CLIENT_KEY);
      const nextWidgets = tossPayments.widgets({ customerKey });
      setWidgets(nextWidgets);
    }

    void fetchPaymentWidgets();
  }, [customerKey]);

  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null) return;

      await widgets.setAmount(amount);
      await Promise.all([
        widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        }),
        widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        }),
      ]);

      setReady(true);
    }

    void renderPaymentWidgets();
  }, [amount, widgets]);

  useEffect(() => {
    if (widgets == null) return;
    void widgets.setAmount(amount);
  }, [amount, widgets]);

  return (
    <div className="mx-auto w-full max-w-[760px] rounded-xl border border-slate-200 bg-white p-5">
      <div id="payment-method" />
      <div id="agreement" className="mt-6" />

      <div className="mt-6">
        <label htmlFor="coupon-box" className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            id="coupon-box"
            type="checkbox"
            disabled={!ready}
            onChange={(event) => {
              setAmount((prev) => ({
                ...prev,
                value: event.target.checked ? prev.value - 5000 : prev.value + 5000,
              }));
            }}
          />
          <span>5,000원 쿠폰 적용</span>
        </label>
      </div>

      <button
        className="mt-6 w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!ready}
        onClick={() => {
          void (async () => {
            if (!widgets) return;
            await widgets.requestPayment({
              orderId,
              orderName,
              successUrl: `${window.location.origin}/shows/reservation/payment/success`,
              failUrl: `${window.location.origin}/shows/reservation/payment/fail`,
              customerEmail,
              customerName,
              customerMobilePhone: customerMobilePhone.replaceAll('-', ''),
            });
          })();
        }}
      >
        결제하기
      </button>
    </div>
  );
}
