function checkoutMetadata({ caseRef, pkg, customerName, customerEmail, subjectName, inputCriteria, county, state }) {
  return {
    caseRef,
    packageId: pkg.id,
    packageName: pkg.name,
    customerName,
    customerEmail,
    subjectName,
    subjectType: inputCriteria.subjectType,
    county,
    state
  };
}

export function buildCheckoutSessionPayload({
  pkg,
  caseRef,
  customerName,
  customerEmail,
  subjectName,
  county,
  state,
  inputCriteria,
  baseUrl,
  statusToken
}) {
  const metadata = checkoutMetadata({ caseRef, pkg, customerName, customerEmail, subjectName, inputCriteria, county, state });
  const successUrl = `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&case_ref=${caseRef}${statusToken ? `&status_token=${encodeURIComponent(statusToken)}` : `&email=${encodeURIComponent(customerEmail)}`}`;

  return {
    mode: 'payment',
    client_reference_id: caseRef,
    customer_creation: 'always',
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: pkg.currency,
          product_data: { name: pkg.name },
          unit_amount: pkg.amount
        },
        quantity: 1
      }
    ],
    metadata,
    payment_intent_data: {
      receipt_email: customerEmail,
      metadata
    },
    success_url: successUrl,
    cancel_url: `${baseUrl}/cancel.html`
  };
}
