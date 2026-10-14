-- List active branches per company (Phase 1.6.1 operator reference)
SELECT c.id AS company_id, c.name AS company_name, b.id AS branch_id, b.code, b.name AS branch_name
FROM companies c
LEFT JOIN branches b ON b.company_id = c.id AND COALESCE(b.is_active, true) = true
WHERE c.is_active = true
ORDER BY c.name, b.code;
