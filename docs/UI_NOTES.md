# 🎨 UI notes

v7 ma styl premium dashboard:

- krótsze buttony: `min-height: 32px`, małe `28px`,
- ciemny glassmorphism,
- emoji w panelach i akcjach,
- prawy panel AI zawsze dostępny,
- score fit, status grantowy, status relacyjny,
- przyciski AI przy profilu grantodawcy.

## v9 inline expansion behavior

- Profile details now open inline directly under the selected organization card.
- Opening a profile no longer calls `scrollIntoView` and does not jump to the bottom of the page.
- The expanded profile pushes the following records down like an accordion.
- Controls inside the expanded profile stop event bubbling, so editing fields, tabs, upload, AI buttons and forms do not re-trigger card selection.
