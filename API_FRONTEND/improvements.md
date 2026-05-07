# Improvements for Voltaris AP Centre 🚀

This document outlines the current technical debt, identified bugs, and strategic improvements for the `voltaris-ui` frontend and the overall system.

---

## 🛠️ Identified Bugs

1. **Leaflet Version Conflict**: The project currently experiences a `render2 is not a function` error when navigating to the Demo page. This is caused by a version mismatch between `react-leaflet` and `leaflet`. 
   - *Status*: Partially fixed by pinning `react-leaflet@4.2.1`.
2. **CORS Mismatch**: The backend was initially only allowing `localhost:3000`, causing network errors when the new UI ran on `localhost:3001`.
3. **Redundant UI State**: There is a conflict between the "Professional Documentation" UI (new) and the "Soft-Deflect Integration" UI (pre-existing in `src/components/demo/`). This causes mixed branding and inconsistent user experience.

---

## 🗑️ "Useless" Things (Technical Debt)

The following files and directories are currently redundant or bloat the project:

1. **`src/components/demo/Demo1...6.tsx`**: These are legacy components from a previous iteration that conflict with the new unified `Demo.tsx` architecture. They should be archived or merged.
2. **`src/lib/deflectApi.ts`**: Redundant. All API logic should be centralized in `src/lib/api.ts`.
3. **`src/lib/mockData.ts`**: While useful for testing, it creates a "fake" success state that can mask real backend connectivity issues. Should be moved to a `tests/mocks` directory.
4. **`src/App.css`**: Completely useless as the project has fully migrated to Tailwind CSS in `src/index.css`.
5. **`.npm-cache/`**: Temporary directory created during installation; should be added to `.gitignore` and deleted.
6. **`src/assets/hero.png` & `react.svg`**: Unused placeholder assets that should be replaced with brand-specific SVG assets.

---

## 🎨 UI Improvements

1. **Unified Theme Engine**: Move from hardcoded colors to Tailwind's `theme.extend` in `tailwind.config.js` to allow easy switching between Light and Dark modes.
2. **Skeleton Loaders**: Implement skeleton screens for the `Playground` and `Demo` analytics to prevent layout shifts during API polling.
3. **Interactive Documentation**: Add a "Copy to Clipboard" feature for JSON response schemas, not just the code snippets.
4. **Map Enhancements**: Use a custom map tile provider (like Mapbox or Stadia) for a more professional "Dark Grid" or "Satellite" view in the Demo.

---

## ⚙️ System Improvements

1. **Global Error Boundary**: Implement a React Error Boundary at the `App.tsx` level to prevent the entire site from going white if a single component (like the Map) fails.
2. **Centralized Auth Hook**: Create a `useAuth` hook to manage the API key state, validation, and persistence in `localStorage`.
3. **API Versioning**: Update the `api.ts` client to handle multiple API versions (v1, v2) through path prefixing.
4. **Automated Testing**: Add Playwright or Cypress for End-to-End (E2E) testing of the API Playground and Demo sync loop.
5. **Vite Alias Cleanup**: Standardize all imports to use `@/` alias (e.g., `import { ... } from '@/lib/api'`) for cleaner code.

---

## 📈 Strategic Roadmap

1. **Step 1**: Delete the `src/components/demo/` directory and consolidate all demo logic into the professional `Demo.tsx` page.
2. **Step 2**: Remove `mockData.ts` and enforce a "Backend Required" policy with the improved error states already implemented.
3. **Step 3**: Implement the `SDK.tsx` page with actual download links for the Python and Node.js wrappers.
