-- Separate WhatsApp number for catering inquiries (admin → WhatsApp & settings).
-- Blank/null = inquiries go to the orders number (settings.whatsapp). Safe to run more than once.
alter table febys.settings add column if not exists inquiry_whatsapp text;
alter table febys.settings drop constraint if exists settings_inquiry_whatsapp_digits;
alter table febys.settings add constraint settings_inquiry_whatsapp_digits check (inquiry_whatsapp is null or inquiry_whatsapp ~ '^[0-9]{9,15}$');
