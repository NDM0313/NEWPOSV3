# Copilot Instructions for DIN COLLECTION ERP

This document provides essential guidelines for AI coding agents working on the DIN COLLECTION ERP project. Understanding these patterns will enable immediate productivity and adherence to project standards.

## 1. Architecture Overview

### Frontend
The application is built using:
-   **Framework:** React 18.3.1 with TypeScript
-   **Styling:** Tailwind CSS v4.0 (primarily Dark Mode)
-   **UI Library:** Radix UI and Lucide Icons
-   **Build Tool:** Vite 6.3.5
-   **Charting:** Recharts 2.15.2
-   **Notifications:** Sonner 2.0.3

### Backend
The frontend is designed to integrate with a **RESTful API backend**. All data is currently **mocked**, and integration points are clearly defined in the `services/api/` directory.

## 2. Core Modules

The system is composed of 10+ core modules, each with its own dedicated folder under `src/app/components/`:
-   `/sales`: Sales module with 6-step workflow
-   `/purchases`: Purchase module with supplier management
-   `/rental`: Rental module for booking systems
-   `/studio`: Studio/Production pipeline
-   `/accounting`: Double-entry bookkeeping system
-   `/expenses`: Expense tracking
-   `/reports`: Contains various report types (20+ available)
-   `/contacts`: Customer and supplier management with multi-role support
-   `/products`: Inventory management and catalog
-   `/dashboard`: Business analytics hub
-   `/settings`: Comprehensive settings with 13 categories (including permissions)
-   `/branches`: Branch management
-   `/salesmen`: Salesmen management
-   `/ui`: Reusable UI components (button, input, select, table, dialog, badge etc.)

## 3. State Management

The application primarily uses **React Hooks and Context API** for state management:
-   `useState`: For local component state.
-   `useEffect`: For side effects.
-   `useRef`: For DOM references.
-   **Context API**: Four major contexts manage global state (e.g., `ThemeProvider`, `ModuleProvider`, `AccountingProvider`, `SettingsProvider`).

## 4. Key Conventions and Patterns

### File Structure
-   **Components**: All feature components reside in `src/app/components/` and are organized into module-specific subfolders (e.g., `src/app/components/sales/`).
-   **Hooks**: Custom React hooks are found in `src/hooks/`.
-   **Services**: API services and client configurations are expected in `src/services/api/`.
-   **Styles**: Global styles and theme definitions are in `src/styles/`.

### Design System
-   **Styling Framework**: Tailwind CSS v4.0.
-   **Theme**: Strict Dark Mode (`#111827`) is enforced; no light theme.
-   **UI Components**: Utilizes Radix UI for base components and Lucide React for icons.
-   **Layout**: Professional drawer-based interface (no modals or popups unless critical), compact table layouts (enterprise ERP standard).

### Global UX Rules
-   **Status Color Behavior**:
    -   Draft → Grey
    -   Quotation → Yellow
    -   Order → Blue
    -   Final → Green
-   **Numeric Input Behavior**:
    -   `0` value → Empty display.
    -   `>0` value → Auto-select on focus (prevents accidental overwrites).
-   **Search Behavior**:
    -   Data attribute: `[data-search-input]`
    -   Focusable via `Ctrl+F`
    -   Debounced for performance.

## 5. Developer Workflows

-   **Build Tool**: Vite is used for development and building.
-   **Debugging**: Utilize browser console for errors and network tab for API issues.
-   **Testing**: Test scenarios are documented within module-specific documentation (e.g., `STUDIO_MODULE_COMPLETE.md`).

## 6. Integration Points & External Dependencies

-   **Backend API**: RESTful API (currently mocked).
-   **Module Integration**: Modules interact through shared contexts and defined interfaces. Examples of integration points can be found in `docs/modules/Expenses_Management_Module.md` (e.g., integration with Vendors, Accounting, Reports, Budget, Approval Workflow modules).

## 7. Reference Key Files

For more in-depth documentation, refer to:
-   `COMPLETE_SYSTEM_DOCUMENTATION.md` (Main system documentation)
-   `SYSTEM_MODULES_SUMMARY.md` (Detailed module summaries)
-   `Figma Mobile ERP App Design/src/CURSOR_AI_AGENT.md` (Existing AI agent setup guide)
-   `GLOBAL_PATTERNS_IMPLEMENTATION.md` (For complete guidelines on global patterns)
-   `src/app/components/ui/searchable-select-examples.md` (Examples for `SearchableSelect` component usage)

---

Please provide feedback on any unclear or incomplete sections to improve these instructions.