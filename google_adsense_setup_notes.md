# Google AdSense Setup Notes

This document outlines the general steps to set up Google AdSense for your website to generate revenue from ads.

## Prerequisites:

1.  **Live Website on a Custom Domain:** Your website must be publicly accessible on a custom domain (e.g., `https://www.yourdomain.com`). AdSense will not approve `localhost` or temporary URLs.
2.  **High-Quality, Original Content:** Your site should have sufficient original, valuable content that adheres to Google's content policies.
3.  **Traffic (Recommended):** While not strictly a requirement for application, having some existing traffic can help with approval and future earnings.

## Setup Steps:

1.  **Create a Google AdSense Account:**
    *   Go to the [Google AdSense website](https://www.google.com/adsense/).
    *   Click "Get started" or "Sign up now."
    *   Follow the prompts to create an account, linking it to your Google Account.
    *   You'll need to provide your website URL and payment information.

2.  **Add AdSense Code to Your Site (for Review):**
    *   After signing up, AdSense will provide you with a piece of code (usually a `<script>` tag).
    *   You need to place this code within the `<head>` section of every page on your website that you want to show ads on.
    *   For Astro projects, this typically means adding it to your main layout component (e.g., `src/layouts/ArticleLayout.astro`).
    *   This code allows Google to verify your site and display ads once approved.

3.  **Site Review Process:**
    *   Once the AdSense code is placed on your site, Google will review your website. This process can take a few days to a few weeks.
    *   They check for compliance with their [AdSense Program Policies](https://support.google.com/adsense/answer/48182).
    *   You will receive an email notification regarding your approval status.

4.  **Set Up Ad Units (After Approval):**
    *   Once your site is approved, you can create "ad units" within your AdSense account.
    *   Ad units define the size and type of ads you want to display (e.g., display ads, in-feed ads, in-article ads).
    *   AdSense will provide specific code snippets for each ad unit.

5.  **Place Ad Unit Code on Your Site:**
    *   Copy the ad unit code and paste it into the specific locations on your website where you want the ads to appear.
    *   For example, you might place a display ad unit in your sidebar, or an in-article ad unit within your article content.
    *   You already have placeholder `div` elements for ads in your Astro components, which can be replaced with the actual AdSense ad unit code.

6.  **Monitor Performance:**
    *   Use your AdSense dashboard to monitor your earnings, impressions, clicks, and other performance metrics.
    *   Experiment with different ad placements and ad unit types to optimize your revenue.

## Important Considerations:

*   **AdSense Program Policies:** Familiarize yourself with and strictly adhere to Google's AdSense Program Policies. Violations can lead to account suspension.
*   **User Experience:** Balance ad placement with user experience. Too many intrusive ads can drive users away.
*   **Traffic is Key:** Your earnings will largely depend on the amount of traffic your website receives.
*   **Payment Thresholds:** AdSense has a minimum payment threshold (e.g., $100). You'll receive payments once your earnings reach this amount.
