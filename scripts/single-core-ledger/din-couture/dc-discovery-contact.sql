SELECT id, name, company_id FROM contacts
WHERE company_id = '2ab65903-62a3-4bcf-bced-076b681e9b74'
  AND name ILIKE '%DHAR%'
ORDER BY name
LIMIT 10;
