# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary groups, treated equally (confirmed 2026-11-25):

- Families and groups in Dubai ordering party trays, packages and holiday combos for gatherings, birthdays, christenings and holidays.
- Office and corporate clients ordering catering for meetings, town halls and company events.

Most visitors are Filipino or familiar with Filipino food; many browse on phones.

## Product Purpose

The website for Feby's Kitchen - Restaurant and Cafe (Al Rigga, Corniche Deira, Dubai; founded 2011). It lets customers browse the menu, build an order and send it on WhatsApp, and lets event clients send a catering inquiry. Success is a complete, correct order or inquiry arriving on WhatsApp with no back-and-forth needed to understand it.

## Positioning

A family-run Filipino kitchen that began in an office kitchen in 2011 and grew through social media into a restaurant, café and caterer. Home-style Filipino cooking with Japanese, Chinese and Korean dishes, sold by the tray and package for sharing.

## Operating Context

- Orders and inquiries finish on WhatsApp; there is no online payment. Staff confirm availability, delivery fee and final total there.
- Delivery and pickup across Dubai; advance booking required.
- Prices exclude delivery; chafing dish rental is extra; some items are priced on request or as a range.
- The owner manages menu items, categories, prices, photos, notices, reviews, gallery and WhatsApp numbers in admin.html (Supabase). The public site falls back to a built-in menu when the live one cannot load.
- Every order sent is also saved to the admin Orders page.

## Capabilities and Constraints

- Static HTML/CSS/vanilla JS (index.html, styles.css, script.js, site-config.js); Supabase for data; no build step.
- One shared cart (localStorage key `febys_cart`) across pages.
- Under-construction switch in site-config.js.
- Hours of operation are not recorded anywhere on the site; do not invent them.

## Brand Commitments

- Name: Feby's Kitchen - Restaurant and Cafe. Tagline: "Homey and Warm Food for You".
- Look follows the Feby's Company Profile 2026: rust brown, warm cream, dusty rose. Owner's own voice in the letter, vision and mission.
- Vision: branches in every Emirate within 3 to 4 years, then the GCC.

## Evidence on Hand

- Real dish and event photos in media/ and in the Supabase gallery.
- Customer messages from the Company Profile 2026 (reviews fallback in script.js); admin-managed reviews may be marked as samples.
- Founder: Feby Cachero Baguisa dela Pena (media/feby.jpg).
- No ratings, review counts, delivery times or opening hours exist; do not fabricate them.

## Product Principles

1. Ordering should feel as easy as messaging the kitchen directly.
2. Show the food: real photos and plain descriptions over decoration.
3. Prices and conditions are stated honestly (on request, ranges, delivery extra).
4. Families and corporate clients are equally served; neither path is buried.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; full keyboard use of menus, dialogs and the order drawer; respect reduced motion.
