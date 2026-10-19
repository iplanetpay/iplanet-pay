-- Run after the app that calls create_used_device_offers (030) is deployed:
-- the 1-device version does not require battery health and blocked a second device.
drop function if exists public.create_used_device_offer(
  uuid, uuid, text, text, integer, integer, text[], boolean, text[]
);
