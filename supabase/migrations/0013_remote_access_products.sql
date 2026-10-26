-- Two more products for guides: Winflector and GO-Global (remote-access tools customers use to run AutoCount
-- from other sites). Existing guides are unchanged; only the allowed list grows.
alter table public.guides drop constraint guides_product_check;
alter table public.guides add constraint guides_product_check
  check (product in ('AutoCount Accounting', 'AutoCount Payroll', 'AutoCount POS', 'AutoCount Account Book', 'Winflector', 'GO-Global'));
