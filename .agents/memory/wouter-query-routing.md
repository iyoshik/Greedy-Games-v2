---
name: Wouter query routing
description: Query-string behavior relevant to routing between the journal list and edit form.
---

When the journal opens an existing entry from history, read its date from `window.location.search` rather than assuming `useLocation()` includes the query string.

**Why:** In this app's Wouter setup, navigation to `/journal?date=...` updated `window.location.search`, while parsing the query from the value returned by `useLocation()` opened a blank entry instead.

**How to apply:** Use the browser search string for query parameters that control page data; keep Wouter's location setter for navigation.
