-- The Supper meal category is now called Dinner. Meal names are stored as plain text.
UPDATE "recipes" SET "meal_type" = 'Dinner' WHERE "meal_type" = 'Supper';
UPDATE "plan_slots" SET "meal" = 'Dinner' WHERE "meal" = 'Supper';

UPDATE "settings"
SET "data" = jsonb_set("data", '{meals}', (
  SELECT jsonb_agg(renamed ORDER BY array_position(ARRAY['Breakfast', 'Lunch', 'Dinner', 'Snack'], renamed))
  FROM (
    SELECT CASE WHEN meal = 'Supper' THEN 'Dinner' ELSE meal END AS renamed
    FROM jsonb_array_elements_text("data"->'meals') AS meal
  ) AS meals
))
WHERE "data"->'meals' ? 'Supper';
