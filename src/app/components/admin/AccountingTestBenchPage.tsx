/**
 * Back-compat: Accounting Test Bench → Developer Integrity Lab (same module).
 * Use explicit default binding so Vite/React.lazy always resolves a component (re-export-only modules can resolve undefined).
 */
import DeveloperIntegrityLabPage from './DeveloperIntegrityLabPage';

export default DeveloperIntegrityLabPage;
