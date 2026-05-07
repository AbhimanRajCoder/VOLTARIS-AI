# Voltaris AP Centre ⚡

A high-fidelity, industry-standard API Documentation and Interactive Demo portal for the Voltaris Grid Intelligence engine. Designed for developers to explore, test, and integrate with real-time grid telemetry.

---

## 🚀 Detailed Features

### 1. Professional API Documentation
The documentation follows a sophisticated **3-column layout** used by top-tier developer platforms (Stripe, Twilio).
- **Navigation**: Structured sidebar for quick access to guides, resources, and core API endpoints.
- **Detailed Guides**: Step-by-step documentation for `Authentication`, `Getting Started`, and `SDK` integration.
- **Deep Endpoint Reference**:
    - **Method & Path**: Clear HTTP verb and endpoint visualization.
    - **Parameter Tables**: Detailed breakdown of query parameters with types, requirement status, and descriptions.
    - **Response Schemas**: Predictive JSON object structures to facilitate backend integration.
- **Multi-Language Snippets**: Instant code examples for **cURL**, **Python (Requests)**, and **Node.js (Axios)**.

### 2. Interactive API Playground
A dedicated environment for real-time experimentation.
- **Test Key Integration**: Built-in support for the `voltaris_test_2026` key to unlock live grid data instantly.
- **Live Execution**: Test actual API calls against the Voltaris backend directly from the UI.
- **Response Buffer**: A high-contrast, syntax-highlighted output window showing live JSON data or detailed error messages.
- **Visual Status**: Unlocked indicators (emerald dots) when a valid API key is active.

### 3. Advanced Geospatial Demo
A high-fidelity visualization of the Voltaris engine in action.
- **Interactive Map**: Powered by **Leaflet**, featuring custom-styled markers for grid nodes and alert hotspots.
- **Live Event Stream**: An auto-syncing sidebar that provides deep context for every grid alert, including impact radius and response status.
- **Grid Load Analytics**: Dynamic area charts (powered by **Recharts**) visualizing load telemetry across the top 10 most active grid zones.
- **System Health Monitor**: Visual indicators for API status and live feed connectivity.

### 4. Resilient Developer Experience
- **Light Theme Design**: A clean, professional slate-and-emerald aesthetic optimized for long development sessions.
- **Resilient UI**: Custom "Backend Offline" state that provides clear recovery instructions and terminal commands when connectivity is lost.
- **Responsive Layout**: Optimized for both high-resolution monitors and portable developer setups.

---

## 📂 Project Structure

```bash
voltaris-ui/
├── public/                # Static assets (Favicons, Icons)
├── src/
│   ├── assets/            # Project-specific images and SVGs
│   ├── components/
│   │   └── layout/        # Global UI components (Sidebar, Header, Layout Wrapper)
│   ├── lib/
│   │   ├── api.ts         # Centralized Axios client with environment-driven base URL
│   │   └── constants.ts   # Core API definitions, endpoints, and shared test keys
│   ├── pages/             # Route-level components
│   │   ├── Docs.tsx       # Main 3-column documentation page
│   │   ├── Demo.tsx       # Interactive map and grid analytics page
│   │   ├── Playground.tsx # API testing environment
│   │   ├── APIKeys.tsx    # Key management and generation dashboard
│   │   └── SDK.tsx        # Future SDK waitlist and guides
│   ├── App.tsx            # Main router configuration (React Router DOM v6)
│   ├── main.tsx           # Application entry point
│   └── index.css          # Tailwind CSS configuration and global styles
├── .env                   # Environment variables (API Base URL)
├── tailwind.config.js     # Tailwind CSS theme customization
└── vite.config.ts         # Vite configuration with path aliases and dev server settings
```

---

## 🔄 Application Flow

### 1. Routing & Navigation
The app uses **React Router DOM v6** for file-based routing. Each major feature (Docs, Demo, Playground) is encapsulated in a dedicated page component, ensuring deep-linking and browser history support.

### 2. Authentication Flow
Authentication is handled via a global `apiKey` state:
- Users can enter keys in the **Global Header** or directly in the **Playground**.
- The `Playground` validates the key against `voltaris_test_2026` before executing calls.
- Valid authentication triggers visual "Unlocked" states across the UI.

### 3. Data Synchronization (The Demo Loop)
The `Demo` and `Playground` pages maintain a live connection to the Voltaris backend:
- **Initialization**: On mount, the component fetches initial telemetry.
- **Polling**: An optimized `setInterval` loop (10s) refreshes the `Grid Summary` and `Alerts` stream.
- **Error Handling**: Network failures are caught by a global handler that triggers the "Backend Offline" state, preventing UI crashes.

---

## ⚙️ Setup & Installation

### Prerequisites
- **Node.js**: v18 or higher.
- **Voltaris Backend**: Ensure the backend service is running on `http://localhost:8000`.

### 1. Installation
```bash
cd voltaris-ui
npm install --legacy-peer-deps
```

### 2. Configuration
Create a `.env` file in the `voltaris-ui` root:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3. Development
```bash
npm run dev -- --port 3001
```
The portal will be available at **`http://localhost:3001`**.

---

## 🔒 Security
- Use the **Test Key**: `voltaris_test_2026` for exploring live data.
- Production keys can be generated in the **API Keys** section but require backend approval for high-rate limit access.
