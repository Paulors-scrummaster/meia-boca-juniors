-- Feature 003 · US1 (Financeiro) · T018
-- Estados e tipos de cobrança. Compatível com a Constituição v1.1.0, Princípio III
-- ("Internal Financial Bookkeeping"): o app registra quem deve, quanto, vencimento
-- e se foi marcado como pago — nunca processa a transação em si.

create type public.charge_status as enum ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
create type public.charge_type as enum ('MONTHLY_AUTOMATIC', 'MANUAL_OVERRIDE', 'EVENT_FEE');
