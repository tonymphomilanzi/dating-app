-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id),
  CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  starter_user_id uuid,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT conversations_starter_user_id_fkey FOREIGN KEY (starter_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.event_attendees (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_attendees_pkey PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  cover_url text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  city text,
  lat numeric,
  lng numeric,
  capacity integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.interests (
  id smallint NOT NULL DEFAULT nextval('interests_id_seq'::regclass),
  label USER-DEFINED NOT NULL UNIQUE,
  CONSTRAINT interests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL,
  user_b_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_at timestamp with time zone,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES public.profiles(id),
  CONSTRAINT matches_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id bigint NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  text text,
  attachment_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT photos_pkey PRIMARY KEY (id),
  CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.preferences (
  user_id uuid NOT NULL,
  interested_in USER-DEFINED NOT NULL DEFAULT 'everyone'::interested_in,
  distance_km integer NOT NULL DEFAULT 50,
  min_age smallint NOT NULL DEFAULT 18,
  max_age smallint NOT NULL DEFAULT 99,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  bio text,
  dob date,
  gender USER-DEFINED,
  avatar_url text,
  city text,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_premium boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.swipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  swiper_id uuid NOT NULL,
  swipee_id uuid NOT NULL,
  dir USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT swipes_pkey PRIMARY KEY (id),
  CONSTRAINT swipes_swiper_id_fkey FOREIGN KEY (swiper_id) REFERENCES public.profiles(id),
  CONSTRAINT swipes_swipee_id_fkey FOREIGN KEY (swipee_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_interests (
  user_id uuid NOT NULL,
  interest_id smallint NOT NULL,
  CONSTRAINT user_interests_pkey PRIMARY KEY (user_id, interest_id),
  CONSTRAINT user_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES public.interests(id)
);