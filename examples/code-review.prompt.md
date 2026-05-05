---
models:
  - anthropic:claude-opus-4-7
  - openai:gpt-5
  - google:gemini-2.5-pro
max_tokens: 600
system: |
  You are a senior staff engineer reviewing code submitted by a junior
  developer. Be direct but kind. Call out real bugs first, then style
  and performance. Suggest concrete fixes with code, not vague advice.
  Keep the whole response under 250 words.
---

Review this function. It's meant to take a list of order objects and
return the total price for orders placed today.

```js
function todaysTotal(orders) {
  let total = 0;
  for (var i = 0; i <= orders.length; i++) {
    const order = orders[i];
    if (order.date == new Date().toDateString()) {
      total += order.price;
    }
  }
  return total;
}
```

Surface every real bug you can find. Then suggest a clean rewrite.
