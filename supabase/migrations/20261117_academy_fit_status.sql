-- Step 4 of docs/COURTLOAD-PLAN.md: fit status per athlete (Goed / Minder fit / Niet fit) + reason, with visibility rules (B):
--  * Status derived from the athlete's own check-in is only used when consent is given (for minors: recorded by the parent).
--  * The coach-set availability (available / limited / unavailable) always counts.
--  * Staff of the athlete's team get a reason (code + detail); a club admin only gets the status, never a reason.
-- Status rules (indicative, the coach decides): unavailable -> not_fit; limited, pain, or a 'watch'/'low' check-in
-- (same thresholds as src/lib/wellness.ts) -> less_fit; a normal check-in -> fit; otherwise unknown.
create or replace function public.academy_fit_status(_club uuid, _day date default null)
returns table(team_id uuid, user_id uuid, status text, reason_code text, reason_detail text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare _today date := coalesce(_day, (now() at time zone 'Europe/Amsterdam')::date);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
  with vis as (
    select t.id as tid,
           exists (select 1 from public.team_members s where s.team_id = t.id and s.user_id = auth.uid() and s.role = 'staff') as is_staff
      from public.teams t
     where t.club_id = _club
       and (public.is_club_admin(_club)
            or exists (select 1 from public.team_members s where s.team_id = t.id and s.user_id = auth.uid() and s.role = 'staff'))
  ), ath as (
    select v.tid, v.is_staff, m.user_id as uid, m.consent_given as consent
      from vis v join public.team_members m on m.team_id = v.tid and m.role = 'athlete'
  ), calc as (
    select a.tid, a.uid, a.is_staff,
           av.status::text as avs, av.note as avnote,
           case when a.consent then w.pain end as pain, case when a.consent then w.pain_location end as ploc,
           case when a.consent and w.id is not null then
             least(w.sleep, w.soreness, w.fatigue, w.stress, w.mood) end as wmin,
           case when a.consent and w.id is not null then
             round(((w.sleep + w.soreness + w.fatigue + w.stress + w.mood) / 5.0)::numeric, 1) end as wavg,
           case when a.consent and w.id is not null then
             (array['sleep','soreness','fatigue','stress','mood'])[
               (select i from (values (1, w.sleep), (2, w.soreness), (3, w.fatigue), (4, w.stress), (5, w.mood)) as q(i, v)
                 order by v, i limit 1)] end as lowest,
           (a.consent and w.id is not null) as has_check
      from ath a
      left join public.availability av on av.team_id = a.tid and av.user_id = a.uid
      left join lateral (
        select * from public.wellness_checks c
         where c.user_id = a.uid and c.day between _today - 1 and _today
         order by c.day desc, c.created_at desc limit 1) w on true
  )
  select c.tid, c.uid,
    case
      when c.avs = 'unavailable' then 'not_fit'
      when c.avs = 'limited' or coalesce(c.pain, false) or (c.has_check and (c.wavg < 3.2 or c.wmin <= 2)) then 'less_fit'
      when c.has_check then 'fit'
      else 'unknown'
    end,
    case when not c.is_staff then null
      when c.avs in ('unavailable', 'limited') then 'availability'
      when coalesce(c.pain, false) then 'pain'
      when c.has_check and (c.wavg < 3.2 or c.wmin <= 2) then c.lowest
    end,
    case when not c.is_staff then null
      when c.avs in ('unavailable', 'limited') then c.avnote
      when coalesce(c.pain, false) then c.ploc
    end
  from calc c;
end;
$function$;
revoke execute on function public.academy_fit_status(uuid, date) from public, anon;
grant execute on function public.academy_fit_status(uuid, date) to authenticated;
