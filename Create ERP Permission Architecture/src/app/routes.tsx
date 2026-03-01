import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { RolesManagement } from "./pages/RolesManagement";
import { PermissionsMatrix } from "./pages/PermissionsMatrix";
import { UsersManagement } from "./pages/UsersManagement";
import { BranchAccess } from "./pages/BranchAccess";
import { RLSSimulator } from "./pages/RLSSimulator";

// 404 Not Found component
function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-emerald-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
        <p className="text-slate-400 mb-6">The page you're looking for doesn't exist.</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/roles",
    Component: RolesManagement,
  },
  {
    path: "/permissions",
    Component: PermissionsMatrix,
  },
  {
    path: "/users",
    Component: UsersManagement,
  },
  {
    path: "/branches",
    Component: BranchAccess,
  },
  {
    path: "/rls-simulator",
    Component: RLSSimulator,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);