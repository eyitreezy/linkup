/**
 * Optional seed — run in SQL editor with service role after first signup.
 * Replace YOUR_USER_UUID with auth.users.id for the account that should be admin.
 */
-- INSERT INTO public.admins (user_id, role) VALUES ('YOUR_USER_UUID', 'super_admin');

-- Example: grant boost credits for testing premium placement
-- UPDATE public.users SET boost_credits = 5 WHERE id = 'YOUR_USER_UUID';
