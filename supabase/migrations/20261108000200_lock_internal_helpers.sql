-- Internal helpers used only inside the student RPCs (which run as the owner):
-- nobody needs to call them directly through the API.
revoke execute on function public.current_confirmed_email(), public.email_allowed_for(uuid, text) from public, anon, authenticated;
