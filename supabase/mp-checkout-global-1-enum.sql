-- PASO 1/2 — Solo el enum. Correr ESTO solo y esperar "Success".
-- Postgres exige commitear el valor nuevo antes de usarlo en índices/funciones.
-- Después corré: mp-checkout-global.sql

alter type public.order_status add value if not exists 'awaiting_payment';
