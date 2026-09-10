begin;

select plan(10);

-- Baseline do MVP presente antes de qualquer trabalho da feature 003.
select has_table('public', 'athletes', 'MVP: athletes table present');
select has_table('public', 'matches', 'MVP: matches table present');
select has_table('public', 'seasons', 'MVP: seasons table present');
select has_table('public', 'match_consolidations', 'MVP: consolidations table present');
select has_function('public', 'consolidate_match', 'MVP: consolidate_match present');
select has_function('private', 'append_audit_log', 'MVP: audit-log helper present');

-- Fundação da feature 003 (Fase 2).
select has_type('public', 'season_status', 'F003: season_status enum present');
select has_function('public', 'open_season', 'F003: open_season present');
select has_function('public', 'close_season', 'F003: close_season present');
select has_function('private', 'evaluate_trophies', 'F003: evaluate_trophies hook present');

select * from finish();
rollback;
