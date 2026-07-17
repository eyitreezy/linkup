-- Bank list now syncs from Flutterwave at runtime; do not hide mobile-money banks locally.
UPDATE public.nigerian_banks
  SET supports_account_resolution = TRUE
  WHERE supports_account_resolution = FALSE;

NOTIFY pgrst, 'reload schema';
