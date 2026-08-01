create table app_user (
  id uuid primary key,
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  created_at timestamp with time zone not null
);

create table orders (
  id uuid primary key,
  user_id uuid not null references app_user(id),
  title varchar(120) not null,
  status varchar(20) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
create index idx_orders_user_created on orders(user_id, created_at desc);
