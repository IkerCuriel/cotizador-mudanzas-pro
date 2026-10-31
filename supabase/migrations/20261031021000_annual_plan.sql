-- Catalog preparation only: annual price is one payment for twelve months.
-- No checkout, provider access, renewal or payment integration is enabled here.
begin;
alter table private.subscription_plans
  drop constraint subscription_plans_billing_interval_check;
alter table private.subscription_plans
  add constraint subscription_plans_billing_interval_check
  check (billing_interval in ('month', 'year'));
insert into private.subscription_plans(code, amount_minor, currency, billing_interval, checkout_enabled)
values ('annual_1440', 144000, 'MXN', 'year', false);
commit;
