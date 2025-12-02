-- Insert admin roles for initial users
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('d526b5d6-6d37-4432-9603-1031737829c6', 'admin'),
  ('317a8313-2a35-4e07-8877-f434eae21581', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;