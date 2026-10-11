/*
# Update project names to be more descriptive

## Changes
- EDU-2024-01: "Rural Education Initiative" → "Rural School Support"
- LIV-2024-02: "Women Livelihood Program" → "Women's Livelihood Training"
- HLT-2024-03: "Community Health Drive" → "Community Health Camps"
- DIG-2024-04: "Digital Literacy Pilot" → "Digital Literacy Drive"
*/
UPDATE projects SET name = 'Rural School Support', updated_at = now() WHERE code = 'EDU-2024-01';
UPDATE projects SET name = 'Women''s Livelihood Training', updated_at = now() WHERE code = 'LIV-2024-02';
UPDATE projects SET name = 'Community Health Camps', updated_at = now() WHERE code = 'HLT-2024-03';
UPDATE projects SET name = 'Digital Literacy Drive', updated_at = now() WHERE code = 'DIG-2024-04';
