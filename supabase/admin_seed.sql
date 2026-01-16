-- 運営（admin）に昇格させるメールアドレスを入れて実行
-- NOTE:
-- - schema.sql 実行前に招待/作成されたユーザーは、profiles が未作成のことがあります。
-- - その場合でもこのSQLは auth.users から profiles を作成(upsert)し、role=admin にします。

insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'
from auth.users u
where lower(u.email) in (
  lower('s.o.r.a.05012075@gmail.com'),
  lower('rentarou.tsunekuni@icloud.com')
)
on conflict (id) do update
set email = excluded.email,
    role = 'admin';
