begin;

select plan(1);

select has_schema('public', 'the local public schema is available');

select * from finish();

rollback;
