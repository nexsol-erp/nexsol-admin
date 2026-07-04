You need paid AI API only for **high-value, difficult, customer-facing tasks** where local models may fail.

Use paid API for:

1. **Complex reasoning**

   * “Why profit dropped across 12 branches?”
   * “Find hidden business pattern.”
   * “Compare 6 months sales, purchase, wastage, discounts.”

2. **High-quality SQL/report generation**

   * New complex reports involving many tables.
   * Financial reports where wrong logic is costly.

3. **Document intelligence**

   * messy purchase invoices
   * supplier invoice OCR correction
   * legal/GST documents
   * handwritten/poor-quality images

4. **Customer-facing chatbot**

   * When your customer directly chats with AI and expects polished answer.

5. **Fallback when local model fails**

   * Local AI gives low confidence.
   * SQL validation fails.
   * User says “wrong answer.”
   * Query is too complex.

6. **Premium AI plan**

   * Free/basic users → local AI only.
   * Premium users → paid API allowed.
   * Charge extra: ₹2,000–₹10,000/month.

Your rule should be:

**Local model for 80–90% work. Paid API only for premium, risky, or complex tasks.**

For your ERP:

* Sales forecast → no paid API
* Stock transfer prediction → no paid API
* Basic report explanation → local
* Simple SQL/report → local
* Complex profit analysis → paid API optional
* Invoice OCR correction → paid API optional
* Business strategy assistant → paid API optional

Build an **AI Gateway** with model routing:

```text
Easy task → local model
Medium task → stronger local model
Hard/risky task → paid API
Failed local answer → paid API fallback
Premium customer → paid API enabled
```

Never expose paid API freely. Put limits per tenant, per user, per month.
