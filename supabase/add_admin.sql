-- 指定したメールアドレスのユーザーを運営（admin）に昇格
-- 使い方:
-- 1) Supabase Dashboard → SQL Editor でこのSQLを実行
-- 2) 'target@example.com' を対象のメールに置き換える
-- 注意:
-- - 対象ユーザーが Auth → Users に存在している必要があります（Invite済み/初回ログイン済み等）

DO $$
DECLARE
  target_email text := lower('target@example.com');
  target_id uuid;
BEGIN
  SELECT u.id INTO target_id
  FROM auth.users u
  WHERE lower(u.email) = target_email
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'auth.users に対象メールが見つかりません: %（先にInvite/作成してください）', target_email;
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (target_id, target_email, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = 'admin';
END $$;
