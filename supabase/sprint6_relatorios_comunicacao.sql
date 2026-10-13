-- Migration SQL for Sprint 6: Communication Reports
-- Add 'comunicacao' to categoria_evento enum

ALTER TYPE public.categoria_evento ADD VALUE IF NOT EXISTS 'comunicacao';
