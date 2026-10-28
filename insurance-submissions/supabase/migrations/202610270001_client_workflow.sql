-- Additive workflow migration. Apply after the original migration; no historical rules or records rewritten.
begin;
create table public.intake_invitations(
 id uuid primary key, business_id uuid not null references public.businesses(id),
 organization_id uuid not null references public.organizations(id),
 email text not null, token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 expires_at timestamptz not null, revoked_at timestamptz, claimed_by uuid references auth.users(id), claimed_at timestamptz
);
alter table public.intake_invitations enable row level security;
revoke all on public.intake_invitations from public,anon,authenticated;
grant select on public.intake_invitations to service_role;
create index intake_invitation_business on public.intake_invitations(business_id);

create function public.issue_intake_invitation(p_actor uuid,p_expected_state jsonb,p_invite jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare b jsonb;
begin
 select state into b from public.businesses where id=(p_invite->>'businessId')::uuid for update;
 if b is null or not public.actor_can_access(p_actor,(b->>'id')::uuid,true) or b<>p_expected_state then raise exception 'Access denied or stale application';end if;
 if p_invite->>'organizationId'<>b->>'organizationId' or p_invite->>'createdBy'<>p_actor::text or p_invite->>'email'<>lower(p_invite->>'email')
 or (p_invite->>'expiresAt')::timestamptz<=now() or (p_invite->>'expiresAt')::timestamptz>now()+interval '14 days 1 minute' then raise exception 'Invalid invitation';end if;
 insert into public.intake_invitations(id,business_id,organization_id,email,token_hash,created_by,expires_at)
 values((p_invite->>'id')::uuid,(b->>'id')::uuid,(b->>'organizationId')::uuid,p_invite->>'email',p_invite->>'tokenHash',p_actor,(p_invite->>'expiresAt')::timestamptz);
 perform public.append_audit(p_actor,(b->>'id')::uuid,'invitation_created',(b->>'revision')::int,jsonb_build_object('invitationId',p_invite->>'id','expiresAt',p_invite->>'expiresAt'));
end;$$;

create function public.revoke_intake_invitation(p_actor uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.intake_invitations%rowtype;
begin
 select * into i from public.intake_invitations where id=p_id for update;
 if i.id is null or not public.actor_can_access(p_actor,i.business_id,true) then raise exception 'Access denied';end if;
 if i.claimed_at is not null then raise exception 'Invitation already claimed; remove client assignment to revoke application access';end if;
 update public.intake_invitations set revoked_at=now() where id=p_id;
 perform public.append_audit(p_actor,i.business_id,'invitation_revoked', (select (state->>'revision')::int from public.businesses where id=i.business_id),jsonb_build_object('invitationId',p_id));
end;$$;

create function public.claim_intake_invitation(p_actor uuid,p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.intake_invitations%rowtype; b jsonb; m public.memberships%rowtype; recipient text;
begin
 select email into recipient from auth.users where id=p_actor and email_confirmed_at is not null;
 select * into i from public.intake_invitations where token_hash=p_token_hash for update;
 if recipient is null or i.id is null or lower(recipient)<>i.email or i.expires_at<=now() or i.revoked_at is not null or i.claimed_at is not null then raise exception 'Invalid invitation or identity';end if;
 insert into public.memberships(user_id,organization_id,role) values(p_actor,i.organization_id,'client') on conflict(user_id) do nothing;
 select * into m from public.memberships where user_id=p_actor for update;
 if m.organization_id<>i.organization_id or m.role<>'client' then raise exception 'Existing membership cannot be changed by invitation';end if;
 select state into b from public.businesses where id=i.business_id and organization_id=i.organization_id for update;
 if b is null then raise exception 'Application unavailable';end if;
 if not (b->'assignedClientIds' ? p_actor::text) then
  b:=jsonb_set(b-'draft'-'approval','{assignedClientIds}',(b->'assignedClientIds')||jsonb_build_array(p_actor::text));
  b:=jsonb_set(b,'{revision}',to_jsonb((b->>'revision')::int+1));
  update public.businesses set state=b,updated_at=now() where id=i.business_id;
 end if;
 update public.intake_invitations set claimed_by=p_actor,claimed_at=now() where id=i.id;
 perform public.append_audit(p_actor,i.business_id,'invitation_claimed',(b->>'revision')::int,jsonb_build_object('invitationId',i.id));
 return i.business_id;
end;$$;

create or replace function public.commit_business(p_actor_id uuid,p_business_id uuid,p_expected_state jsonb,p_state jsonb,p_action text,p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare current_state jsonb; is_broker boolean;
begin
 select state into current_state from public.businesses where id=p_business_id for update;
 if current_state is null or not public.actor_can_access(p_actor_id,p_business_id,false) then raise exception 'Access denied';end if;
 if current_state<>p_expected_state then raise exception 'Stale application state';end if;
 is_broker:=public.actor_can_access(p_actor_id,p_business_id,true);
 if not is_broker and p_action not in ('answer','document_uploaded','save_response','submit_intake','clarification_response') then raise exception 'Broker required';end if;
 if p_action not in ('answer','verify','profile','draft','approve','document_uploaded','document_review','assign_client','save_response','submit_intake','clarification_request','clarification_response','clarification_resolve') then raise exception 'Invalid action';end if;
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


revoke all on function public.issue_intake_invitation(uuid,jsonb,jsonb), public.revoke_intake_invitation(uuid,uuid),public.claim_intake_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.issue_intake_invitation(uuid,jsonb,jsonb), public.revoke_intake_invitation(uuid,uuid),public.claim_intake_invitation(uuid,text) to service_role;
commit;
