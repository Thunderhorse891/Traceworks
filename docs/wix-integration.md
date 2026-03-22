# Wix Integration

TraceWorks remains a Netlify-first PWA. The Wix path in this repo is intentionally a design and merchandising bridge, not a migration of the live backend into Wix.

## What This Supports

- A Wix Studio custom element that uses the real TraceWorks package catalog and premium visual direction
- A generated JavaScript bundle that can be hosted over HTTPS and placed inside Wix as a Custom Element
- A preview HTML file so the generated element can be reviewed before it is attached to a Wix site

## What This Does Not Do

- It does not move the TraceWorks API, Stripe webhook, fulfillment queue, or authenticated report delivery into Wix
- It does not convert this repo into a native Wix site-code repository
- It does not replace the Netlify deployment target for the live app

## Why This Route

Wix supports self-hosted site widgets with custom elements, which is the safest way to preserve the current TraceWorks frontend design without rewriting the app into Wix-specific page code. Wix also supports Git-based site code workflows, but those are for Wix-managed site projects and are not a drop-in replacement for this Netlify PWA.

Official docs used for this approach:

- [Wix custom elements for self-hosted site widgets](https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/self-hosting/supported-extensions/site-extensions/site-widgets-and-plugins/add-self-hosted-site-widget-extensions-with-custom-elements)
- [Wix GitHub integration for Wix-managed site code](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli/integrating-your-site-with-git-hub)

## Build

Run:

```bash
npm run build:wix
```

Optional:

```bash
npm run build:wix -- --app-url https://your-traceworks-domain.example
```

This creates:

- `output/wix/traceworks-landing.element.js`
- `output/wix/traceworks-landing.preview.html`
- `output/wix/README.md`

## Wix Studio Setup

1. Host `output/wix/traceworks-landing.element.js` on an HTTPS origin you control.
2. In Wix Studio, add a Custom Element.
3. Use the tag name `traceworks-landing`.
4. Point the element to the hosted JavaScript file.
5. Set the `app-base-url` attribute to your real TraceWorks app domain.
6. Publish the Wix page.

## Attributes

- `app-base-url`
  Routes buttons and package CTAs into the real TraceWorks intake flow.
- `headline`
  Optional override for the main widget headline.
- `subhead`
  Optional override for the supporting copy.
- `max-packages`
  Optional limit for how many packages render.

## Recommendation

Use Wix as the marketing front door only if you need it for brand or CMS reasons. Keep the actual checkout, launch gating, fulfillment pipeline, and report delivery in the main TraceWorks app where they already exist and are tested.
