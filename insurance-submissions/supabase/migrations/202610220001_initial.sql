-- Apply to a new Supabase project using its SQL editor or Supabase CLI.
begin;
create table public.organizations(id uuid primary key, name text not null);
create table public.memberships(
 user_id uuid primary key references auth.users(id),
 organization_id uuid not null references public.organizations(id),
 role text not null check(role in ('admin','broker','client'))
);
create table public.industry_rules(
 version text primary key, industry text not null, provenance text not null,
 rules jsonb not null, created_at timestamptz not null default now()
);
create table public.businesses(
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 state jsonb not null,
 rules_version text generated always as (state->>'rulesVersion') stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint state_identity check(state->>'id'=id::text and state->>'organizationId'=organization_id::text),
 constraint pinned_rules foreign key (rules_version) references public.industry_rules(version)
);

create table public.audit_events(
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 event jsonb not null, created_at timestamptz not null default now()
);
create table public.submission_snapshots(
 id uuid primary key, business_id uuid not null references public.businesses(id),
 approval_id uuid not null, revision integer not null, digest text not null,
 content text not null, created_at timestamptz not null default now()
);
create index businesses_org_idx on public.businesses(organization_id);
create index audit_business_idx on public.audit_events(business_id,created_at desc);

-- All authorization looks up authoritative membership, never client-provided JWT metadata.
create function public.can_access_business(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses b join public.memberships m on m.organization_id=b.organization_id
 where b.id=p_id and m.user_id=auth.uid() and (m.role in ('admin','broker') or b.state->'assignedClientIds' ? auth.uid()::text));
$$;
create function public.is_broker_for(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses b join public.memberships m on m.organization_id=b.organization_id
 where b.id=p_id and m.user_id=auth.uid() and m.role in ('admin','broker'));
$$;
create function public.actor_can_access(p_actor uuid,p_id uuid,p_broker boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses b join public.memberships m on m.organization_id=b.organization_id
 where b.id=p_id and m.user_id=p_actor and (m.role in ('admin','broker') or (not p_broker and m.role='client' and b.state->'assignedClientIds' ? p_actor::text)));
$$;
revoke all on function public.actor_can_access(uuid,uuid,boolean) from public,anon,authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.industry_rules enable row level security;
alter table public.businesses enable row level security;
alter table public.audit_events enable row level security;
alter table public.submission_snapshots enable row level security;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
create policy own_organization on public.organizations for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=id and m.user_id=auth.uid()));
create policy readable_rules on public.industry_rules for select to authenticated using(true);
create policy scoped_businesses on public.businesses for select to authenticated using(public.is_broker_for(id));
create policy broker_audit on public.audit_events for select to authenticated using(public.is_broker_for(business_id));
create policy broker_snapshots on public.submission_snapshots for select to authenticated using(public.is_broker_for(business_id));
-- No browser write grants or write policies. Mutations go through the authenticated
-- Next.js server and service-role-only atomic RPCs after domain validation.
revoke all on public.organizations,public.memberships,public.industry_rules,public.businesses,public.audit_events,public.submission_snapshots from anon,authenticated;
grant select on public.organizations,public.memberships,public.industry_rules,public.businesses,public.audit_events,public.submission_snapshots to authenticated;
grant select,insert on public.organizations,public.memberships,public.industry_rules,public.businesses to service_role;
grant update on public.organizations,public.memberships to service_role;
grant select on public.audit_events,public.submission_snapshots to service_role;

create function public.append_audit(p_actor uuid,p_id uuid,p_action text,p_revision integer,p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare event_id uuid := gen_random_uuid();
begin
 insert into public.audit_events(id,business_id,event) values(event_id,p_id,jsonb_build_object('id',event_id,'businessId',p_id,'actorId',p_actor,'actorName',p_actor::text,'action',p_action,'revision',p_revision,'at',now(),'detail',p_detail));
end; $$;

create function public.create_business(p_actor_id uuid,p_state jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.memberships where user_id=p_actor_id and organization_id=(p_state->>'organizationId')::uuid and role in ('broker','admin')) then raise exception 'Access denied'; end if;
 if p_state->>'revision'<>'1' or jsonb_array_length(p_state->'assignedClientIds')<>0 then raise exception 'Invalid initial state';end if;
 insert into public.businesses(id,organization_id,state) values((p_state->>'id')::uuid,(p_state->>'organizationId')::uuid,p_state);
 perform public.append_audit(p_actor_id,(p_state->>'id')::uuid,'business_created',1,'{}');
end; $$;

create function public.commit_business(p_actor_id uuid,p_business_id uuid,p_expected_state jsonb,p_state jsonb,p_action text,p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare current_state jsonb; is_broker boolean;
begin
 select state into current_state from public.businesses where id=p_business_id for update;
 if current_state is null or not public.actor_can_access(p_actor_id,p_business_id,false) then raise exception 'Access denied';end if;
 if current_state<>p_expected_state then raise exception 'Stale application state';end if;
 is_broker:=public.actor_can_access(p_actor_id,p_business_id,true);
 if not is_broker and p_action not in ('answer','document_uploaded') then raise exception 'Broker required';end if;
 if p_action not in ('answer','verify','profile','draft','approve','document_uploaded','document_review','assign_client') then raise exception 'Invalid action';end if;
 if p_state->>'id'<>current_state->>'id' or p_state->>'organizationId'<>current_state->>'organizationId'
 or (p_action<>'assign_client' and p_state->'assignedClientIds'<>current_state->'assignedClientIds') or p_state->>'rulesVersion'<>current_state->>'rulesVersion'
 then raise exception 'Immutable identity or rules changed';end if;
 if p_action='assign_client' and exists(select 1 from jsonb_array_elements_text(p_state->'assignedClientIds') as assigned(value) where not exists(select 1 from public.memberships m where m.user_id::text=assigned.value and m.organization_id=(current_state->>'organizationId')::uuid and m.role='client')) then raise exception 'Invalid client assignment';end if;
 if p_action='approve' then
  if p_state->>'revision'<>current_state->>'revision' or p_state-'approval'<>current_state-'approval' or p_state->'approval'->>'brokerId'<>p_actor_id::text then raise exception 'Invalid approval';end if;
 else
  if (p_state->>'revision')::integer<>(current_state->>'revision')::integer+1 or p_state ? 'approval' then raise exception 'Revision or approval invalidation required';end if;
 end if;
 update public.businesses set state=p_state,updated_at=now() where id=p_business_id;
 perform public.append_audit(p_actor_id,p_business_id,p_action,(p_state->>'revision')::integer,p_detail);
end; $$;

create function public.record_snapshot(p_actor_id uuid,p_business_id uuid,p_expected_state jsonb,p_snapshot jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare current_state jsonb;
begin
 select state into current_state from public.businesses where id=p_business_id for update;
 if not public.actor_can_access(p_actor_id,p_business_id,true) or current_state<>p_expected_state then raise exception 'Access denied or stale approval';end if;
 if current_state->'approval' is null or p_snapshot->>'approvalId'<>current_state->'approval'->>'id'
 or p_snapshot->>'digest'<>current_state->'approval'->>'digest' or p_snapshot->>'revision'<>current_state->>'revision' then raise exception 'Approval mismatch';end if;
 insert into public.submission_snapshots(id,business_id,approval_id,revision,digest,content) values((p_snapshot->>'id')::uuid,p_business_id,(p_snapshot->>'approvalId')::uuid,(p_snapshot->>'revision')::integer,p_snapshot->>'digest',p_snapshot->>'content');
 perform public.append_audit(p_actor_id,p_business_id,'final_generated',(current_state->>'revision')::integer,jsonb_build_object('snapshotId',p_snapshot->>'id','approvalId',p_snapshot->>'approvalId','digest',p_snapshot->>'digest'));
end; $$;

create function public.log_document_access(p_actor_id uuid,p_business_id uuid,p_document_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_state jsonb;
begin
 select state into current_state from public.businesses where id=p_business_id;
 if not public.actor_can_access(p_actor_id,p_business_id,false) or not exists(select 1 from jsonb_array_elements(current_state->'documents') d where d->>'id'=p_document_id::text) then raise exception 'Access denied';end if;
 perform public.append_audit(p_actor_id,p_business_id,'document_download_requested',(current_state->>'revision')::integer,jsonb_build_object('documentId',p_document_id));
end; $$;

-- Append-only audit, immutable snapshots, and immutable published rule versions.
create function public.deny_history_mutation() returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'Append-only record';end; $$;
create trigger immutable_audit before update or delete on public.audit_events for each row execute function public.deny_history_mutation();
create trigger immutable_snapshots before update or delete on public.submission_snapshots for each row execute function public.deny_history_mutation();
create trigger immutable_rules before update or delete on public.industry_rules for each row execute function public.deny_history_mutation();

revoke all on function public.append_audit(uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.create_business(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.commit_business(uuid,uuid,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.record_snapshot(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.log_document_access(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_business(uuid,jsonb),public.commit_business(uuid,uuid,jsonb,jsonb,text,jsonb),public.record_snapshot(uuid,uuid,jsonb,jsonb),public.log_document_access(uuid,uuid,uuid) to service_role;
revoke all on function public.can_access_business(uuid),public.is_broker_for(uuid) from public,anon;
grant execute on function public.can_access_business(uuid),public.is_broker_for(uuid) to authenticated;


-- Clients can read only their assigned intake state, never broker drafts or approval metadata.
create view public.client_businesses with (security_barrier=true) as
 select b.id,b.organization_id,b.created_at,b.state-'draft'-'approval' as state
 from public.businesses b
 where exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role='client' and m.organization_id=b.organization_id and b.state->'assignedClientIds' ? auth.uid()::text);
revoke all on public.client_businesses from public,anon;
grant select on public.client_businesses to authenticated;
create table public.business_revisions(
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 revision integer not null, state jsonb not null, recorded_at timestamptz not null default now()
);
alter table public.business_revisions enable row level security;
create policy broker_revisions on public.business_revisions for select to authenticated using(public.is_broker_for(business_id));
revoke all on public.business_revisions from anon,authenticated;
grant select on public.business_revisions to authenticated;
grant select on public.business_revisions to service_role;
create function public.retain_business_revision() returns trigger language plpgsql security definer set search_path = '' as $$ begin
 insert into public.business_revisions(business_id,revision,state) values(new.id,(new.state->>'revision')::integer,new.state);return new;end; $$;
create trigger retain_revisions after insert or update on public.businesses for each row execute function public.retain_business_revision();
create trigger immutable_revisions before update or delete on public.business_revisions for each row execute function public.deny_history_mutation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('client-documents','client-documents',false,10485760,array['application/pdf','image/png','image/jpeg']);
-- No authenticated Storage policies. The server authorizes every upload/download,
-- uses opaque paths, and issues attachment-only signed URLs for 60 seconds.
commit;
