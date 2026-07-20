# Project Rules

- **Brain Maintenance**: Always consult and proactively update `brain.md` (in the root directory) whenever architectural decisions are made, tasks are completed, or important project state changes occur. It is the central source of truth for the project's current status and thoughts.
- **Data Isolation**: For all backend analytic endpoints (FastAPI), always ensure data is filtered by `current_user.id` or `organization_id` to prevent data leakage between users.
- **UI Styling**: Avoid hardcoding specific Tailwind text/background colors (like `bg-slate-800` or `text-white`). Use dynamic CSS variables (e.g., `var(--bg-elevated)`, `var(--text-primary)`) to ensure seamless Light/Dark mode compatibility.
- **Tickets Module**: Ensure `TicketResponse` models and frontend pages handle `updated_at` properties correctly without breaking if missing.
