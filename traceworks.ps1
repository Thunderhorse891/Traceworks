<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TraceWorks™ Terms of Service</title>
    <link rel="stylesheet" href="/styles.css" />
    <!-- Progressive Web App manifest -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#ffffff" />
  </head>
  <body>
    <main class="container form-wrap" style="margin-top:24px; max-width: 860px;">
      <h1>TraceWorks™ Terms of Service</h1>
      <p>By submitting an order, you represent that you are authorized to request legal or investigative support and that you will use all deliverables for lawful purposes only.</p>
      <h3>Lawful Use Requirement</h3>
      <p>No stalking, harassment, intimidation, unlawful surveillance, identity theft, or any other prohibited activity. We may refuse service for any prohibited use case.</p>
      <h3>Professional Responsibility</h3>
      <p>Reports are investigative research briefs. They are not legal advice and must be verified with official records before filing, service attempts, or court submission.</p>
      <h3>Service Policy</h3>
      <p><strong>No refunds once research work has started.</strong> If quality concerns are raised in good faith, TraceWorks™ may provide one redo pass on the same scope.</p>
      <h3>Liability Limits</h3>
      <p>Public-record availability and third-party provider output vary. We do not guarantee outcome, completeness, or admissibility without independent verification.</p>
      <p><a href="/">Back to home</a></p>
    </main>
    <script>
      // Register the service worker for offline support when available.
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js').catch(() => {});
        });
      }
    </script>
  </body>
</html>
