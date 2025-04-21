# RIA Test Prompt URLs

These URLs can be used to test the RIA chatbot with predefined questions on the staging environment.

## Test URLs - Staging Environment

**RIA PROMPT 1: How do the manager cutbacks affect workers?**

```
https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS?question=How%20do%20the%20manager%20cutbacks%20affect%20workers%3F
```

**RIA PROMPT 2: How is the cost of living affecting different workers across industries?**

```
https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS?question=How%20is%20the%20cost%20of%20living%20affecting%20different%20workers%20across%20industries%3F
```

**RIA PROMPT 3: What are different countries doing to prepare for AI and how is this impacting workers?**

```
https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS?question=What%20are%20different%20countries%20doing%20to%20prepare%20for%20AI%20and%20how%20is%20this%20impacting%20workers%3F
```

**RIA PROMPT 4: What did workers tell us about their preference for flexibility?**

```
https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS?question=What%20did%20workers%20tell%20us%20about%20their%20preference%20for%20flexibility%3F
```

**RIA PROMPT 5: What are the biggest challenges when it comes to working across generations?**

```
https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS?question=What%20are%20the%20biggest%20challenges%20when%20it%20comes%20to%20working%20across%20generations%3F
```

## For iFrame Embedding

Example HTML:

```html
<!-- Parent page script to handle iframe resizing -->
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "resize") {
      const iframe = document.querySelector("iframe#ria-chat");
      if (iframe) {
        iframe.style.height = e.data.height + "px";
      }
    }
  });
</script>

<!-- Iframe with minimum height -->
<iframe
  id="ria-chat"
  src="https://ria25-staging.vercel.app/embed/asst_D0BPAJjvg3UK6Lcb1lqIM1xS"
  width="100%"
  style="min-height: 500px; width: 100%; border: none;"
  frameborder="0"
>
</iframe>
```

## How to Use

1. These URLs can be used directly in a browser or as the `src` attribute in an iframe
2. The system will automatically process the question parameter and populate the chat input
3. The iframe will automatically resize to fit its content

## URL Structure

The structure follows:

```

```
