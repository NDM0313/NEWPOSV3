SELECT id, code, name, company_id, type
FROM contacts
WHERE upper(name) LIKE '%JALIL%' OR upper(code) LIKE '%JALIL%'
ORDER BY name
LIMIT 20;
