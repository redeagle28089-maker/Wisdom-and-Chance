--
-- PostgreSQL database dump
--

\restrict nSN65W1QA1YC7pa5dMS2PYA4CJ1H7EzTKcNWbbeqnqSpp8daqrCZsDU4HpY3QYn

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievements (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text NOT NULL,
    category character varying(20) NOT NULL,
    icon character varying(50),
    requirement integer DEFAULT 1 NOT NULL,
    xp_reward integer DEFAULT 100,
    is_secret boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.achievements OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    room_id character varying,
    game_id character varying,
    sender_id character varying NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: daily_challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_challenges (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text NOT NULL,
    challenge_type character varying(30) NOT NULL,
    requirement integer NOT NULL,
    element_filter character varying(20),
    xp_reward integer DEFAULT 50,
    active_date timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.daily_challenges OWNER TO postgres;

--
-- Name: deck_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deck_codes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    deck_name character varying(100) NOT NULL,
    commander_id character varying NOT NULL,
    card_ids jsonb NOT NULL,
    creator_id character varying,
    is_public boolean DEFAULT false,
    uses integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.deck_codes OWNER TO postgres;

--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friend_requests (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    sender_id character varying NOT NULL,
    receiver_id character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.friend_requests OWNER TO postgres;

--
-- Name: friendships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friendships (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    friend_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.friendships OWNER TO postgres;

--
-- Name: game_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.game_rooms (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    host_id character varying NOT NULL,
    guest_id character varying,
    is_private boolean DEFAULT false,
    password character varying(100),
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    host_deck_id character varying,
    guest_deck_id character varying,
    host_ready boolean DEFAULT false,
    guest_ready boolean DEFAULT false,
    game_id character varying,
    max_spectators integer DEFAULT 10,
    settings jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.game_rooms OWNER TO postgres;

--
-- Name: matchmaking_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matchmaking_queue (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    deck_id character varying NOT NULL,
    rating integer DEFAULT 1000,
    queue_type character varying(20) DEFAULT 'ranked'::character varying,
    joined_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.matchmaking_queue OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: player_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_achievements (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    achievement_id character varying NOT NULL,
    progress integer DEFAULT 0,
    unlocked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.player_achievements OWNER TO postgres;

--
-- Name: player_challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_challenges (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    challenge_id character varying NOT NULL,
    progress integer DEFAULT 0,
    completed_at timestamp without time zone,
    claimed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.player_challenges OWNER TO postgres;

--
-- Name: player_ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_ratings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    rating integer DEFAULT 1000,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    streak integer DEFAULT 0,
    highest_rating integer DEFAULT 1000,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.player_ratings OWNER TO postgres;

--
-- Name: player_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_stats (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    total_xp integer DEFAULT 0,
    level integer DEFAULT 1,
    games_played integer DEFAULT 0,
    games_won integer DEFAULT 0,
    games_lost integer DEFAULT 0,
    total_damage_dealt integer DEFAULT 0,
    total_cards_played integer DEFAULT 0,
    favorite_element character varying(20),
    favorite_commander character varying,
    longest_win_streak integer DEFAULT 0,
    current_win_streak integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.player_stats OWNER TO postgres;

--
-- Name: room_spectators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room_spectators (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    room_id character varying NOT NULL,
    user_id character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.room_spectators OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: user_decks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_decks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    name character varying NOT NULL,
    commander_id character varying NOT NULL,
    card_ids text[] NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_decks OWNER TO postgres;

--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_presence (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    status character varying(20) DEFAULT 'offline'::character varying,
    current_room_id character varying,
    current_game_id character varying,
    last_seen timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_presence OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.achievements (id, name, description, category, icon, requirement, xp_reward, is_secret, created_at) FROM stdin;
5c2333f9-590a-4dd9-a188-fe70b7305c55	First Victory	Win your first game	wins	trophy	1	100	f	2026-01-15 14:18:11.39042
398b02ab-ccfd-412f-ba07-536b03efa563	Winning Streak	Win 5 games in a row	wins	flame	5	250	f	2026-01-15 14:18:11.39042
4eb40072-afa3-44b4-b7c9-b8c8458e181a	Champion	Win 10 games total	wins	crown	10	500	f	2026-01-15 14:18:11.39042
8b566a6c-ab33-40d2-9d74-efb2f17d6733	Legendary	Win 50 games total	wins	star	50	1000	f	2026-01-15 14:18:11.39042
772d77b1-69f7-40e7-9f4b-24c137e28f04	Master Duelist	Win 100 games total	wins	medal	100	2000	f	2026-01-15 14:18:11.39042
e85f0031-eb95-4086-9485-84a3d24456ef	Newcomer	Play your first game	games	swords	1	50	f	2026-01-15 14:18:11.39042
14a99f9c-cc35-4c97-9679-6cf9172f07bd	Regular	Play 10 games	games	swords	10	200	f	2026-01-15 14:18:11.39042
fe467958-4afb-4d91-8d6b-96c9efc23f83	Veteran	Play 50 games	games	swords	50	500	f	2026-01-15 14:18:11.39042
9b34bf72-699d-4622-bed5-cd4fb954baff	Dedicated	Play 100 games	games	swords	100	1000	f	2026-01-15 14:18:11.39042
471a2eca-ce38-4526-8ef2-d12568abcd43	Fire Adept	Win 10 games using a Fire commander	collection	flame	10	300	f	2026-01-15 14:18:11.39042
94047e70-e6f5-4c67-bbcf-aac44e30f454	Water Adept	Win 10 games using a Water commander	collection	droplet	10	300	f	2026-01-15 14:18:11.39042
110044e3-b358-434f-9f3a-a1b77d24a1ae	Earth Adept	Win 10 games using an Earth commander	collection	mountain	10	300	f	2026-01-15 14:18:11.39042
2c6746b9-31be-4ef0-b5bd-2eea00711b08	Air Adept	Win 10 games using an Air commander	collection	wind	10	300	f	2026-01-15 14:18:11.39042
8fbfe754-123d-4eb7-87d2-2932c8b551ba	Nature Adept	Win 10 games using a Nature commander	collection	leaf	10	300	f	2026-01-15 14:18:11.39042
2b13d3d5-d17a-4e98-bff2-48b001579749	Deck Builder	Create your first deck	collection	layers	1	100	f	2026-01-15 14:18:11.39042
8889694a-a25b-48a8-ad55-468a6b8f6cba	Deck Master	Create 5 decks	collection	layers	5	250	f	2026-01-15 14:18:11.39042
519a3450-d5c2-4023-8135-88bf128a1ecf	Friendly Player	Add your first friend	social	users	1	100	f	2026-01-15 14:18:11.39042
464bbbe6-567b-4af6-b586-aeb263a5f925	Social Butterfly	Add 10 friends	social	users	10	300	f	2026-01-15 14:18:11.39042
002a46a9-5c23-4a3b-99b3-750ad7c5c347	Room Host	Host your first multiplayer room	social	gamepad	1	100	f	2026-01-15 14:18:11.39042
5e7c55b0-ef15-4d63-9f31-d87c3ca6b320	Perfect Game	Win a game without taking any damage	special	sparkles	1	500	t	2026-01-15 14:18:11.39042
0fdf78c6-e7cd-4021-9065-44737645a4b9	Comeback King	Win a game after being at 10 HP or less	special	zap	1	400	t	2026-01-15 14:18:11.39042
f8335bca-4c1e-4f63-b082-91bfca5f12a0	Speed Demon	Win a game in under 5 turns	special	zap	1	600	t	2026-01-15 14:18:11.39042
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (id, room_id, game_id, sender_id, message, created_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, title, created_at) FROM stdin;
\.


--
-- Data for Name: daily_challenges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_challenges (id, name, description, challenge_type, requirement, element_filter, xp_reward, active_date, created_at) FROM stdin;
2c4f51ce-2933-4f19-973e-13884a921d98	Fire Storm	Win 3 games using Fire cards	play_element	3	Fire	75	2026-01-15 00:00:00	2026-01-15 14:18:25.413844
756bd3c0-82ce-4820-9311-7720392b491f	Quick Victory	Win 2 games today	win_games	2	\N	100	2026-01-15 00:00:00	2026-01-15 14:18:25.413844
844bb70b-428a-4d31-bd65-cce8b2fc57ba	Card Collector	Play 20 cards in games	play_cards	20	\N	50	2026-01-15 00:00:00	2026-01-15 14:18:25.413844
\.


--
-- Data for Name: deck_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deck_codes (id, code, deck_name, commander_id, card_ids, creator_id, is_public, uses, created_at) FROM stdin;
\.


--
-- Data for Name: friend_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.friend_requests (id, sender_id, receiver_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.friendships (id, user_id, friend_id, created_at) FROM stdin;
\.


--
-- Data for Name: game_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.game_rooms (id, name, host_id, guest_id, is_private, password, status, host_deck_id, guest_deck_id, host_ready, guest_ready, game_id, max_spectators, settings, created_at, updated_at) FROM stdin;
ecf619fd-086f-4236-b9d9-c0fec36bae8c	MP-Test-Q3EB35	mp-player-1-Ox2bYq	mp-player-2-biq3Sx	f	\N	waiting	\N	\N	f	f	\N	10	{"gameMode": "standard"}	2026-01-28 17:59:39.905672	2026-01-28 18:01:07.178
972e9073-2a9f-4b05-9451-d6cdf9432d15	GameRoom-buc7	game-p1-sIqsYX	game-p2-s_bYcR	f	\N	waiting	d43110bf-f02b-4049-b18a-d5833bfcd403	ff693b38-1f6c-4b3b-a913-fccf0148a486	f	f	\N	10	{"gameMode": "standard"}	2026-01-28 18:11:04.488363	2026-01-28 18:18:42.53
2d3c5965-3205-4fc2-9ccd-98d1bb5d42cd	ManualTest-LlbS	manual-host-${nanoid(4)}	manual-guest-wpwX	f	\N	waiting	\N	\N	f	f	\N	10	{"gameMode": "standard"}	2026-01-28 18:31:55.847225	2026-01-28 18:37:14.474
d1ba9534-94b9-4384-a597-57a274f1d0e8	Test Room kz7i	test-user-mp-p5q2Yd	\N	f	\N	waiting	\N	\N	f	f	\N	10	{"gameMode": "standard"}	2026-01-28 19:00:12.1718	2026-01-28 19:00:12.1718
adc86aa4-4c01-4133-a0cf-59095727da13	Test Room From Automation	mp-test-seed-abc	\N	f	\N	waiting	\N	\N	f	f	\N	10	{"gameMode": "standard"}	2026-01-28 19:17:20.245111	2026-01-28 19:17:20.245111
\.


--
-- Data for Name: matchmaking_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.matchmaking_queue (id, user_id, deck_id, rating, queue_type, joined_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: player_achievements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_achievements (id, user_id, achievement_id, progress, unlocked_at, created_at) FROM stdin;
\.


--
-- Data for Name: player_challenges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_challenges (id, user_id, challenge_id, progress, completed_at, claimed_at, created_at) FROM stdin;
\.


--
-- Data for Name: player_ratings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_ratings (id, user_id, rating, wins, losses, streak, highest_rating, updated_at) FROM stdin;
\.


--
-- Data for Name: player_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_stats (id, user_id, total_xp, level, games_played, games_won, games_lost, total_damage_dealt, total_cards_played, favorite_element, favorite_commander, longest_win_streak, current_win_streak, updated_at) FROM stdin;
\.


--
-- Data for Name: room_spectators; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.room_spectators (id, room_id, user_id, joined_at) FROM stdin;
5ce3562a-2581-4f97-bc75-c1a72c95aa63	972e9073-2a9f-4b05-9451-d6cdf9432d15	spectator-OJaXfB	2026-01-28 18:18:19.278676
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
LSsnciUBqAzKVNIpzS5c4g2Zeumst-YV	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:54:11.908Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769630051, "iat": 1769626451, "iss": "https://replit.com/oidc", "sub": "50128681", "email": "redeagle28089@gmail.com", "at_hash": "sID_nGN6CtFmGFc8RsNXLQ", "username": "redeagle28089", "auth_time": 1769572707, "last_name": "William Myers", "first_name": "Jason"}, "expires_at": 1769630051, "access_token": "OEpu4cYHxwu-6kYgZr7w4bHKIecy69-YbaQ7H8WrDFD", "refresh_token": "JhDTeDsyKhAgyLB2x4rcYJBrqKjdJ30sy5ejH0R1nzt"}}}	2026-02-04 19:18:56
_MYDAdxdYCPHZiqS1IBstxgm7WZallbq	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-01T02:17:42.790Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769311062, "iat": 1769307462, "iss": "https://replit.com/oidc", "sub": "50128681", "email": "redeagle28089@gmail.com", "at_hash": "FYCZkfsGoevlXln7697e8g", "username": "redeagle28089", "auth_time": 1768886811, "last_name": "William Myers", "first_name": "Jason"}, "expires_at": 1769311062, "access_token": "FLOZFLYkg4UP7BZZMelCokVECLV5L91xrQhUahLgHG_", "refresh_token": "mvSFqhj_aNmRHFQau5zLdh8FmS5TK1v0cTwtNoE6tTl"}}}	2026-02-01 02:17:43
-F_SB5p7NartFpSebwJdR-fEt11piQ8a	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:34:03.336Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769135643, "iat": 1769132043, "iss": "https://test-mock-oidc.replit.app/", "jti": "e24c8d5a7c4341c85d504789c7b5fde4", "sub": "ai-test-1RW5y-", "email": "aitestjtFx3S@example.com", "auth_time": 1769132043, "last_name": "Tester", "first_name": "AI"}, "expires_at": 1769135643, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMyMDQzLCJleHAiOjE3NjkxMzU2NDMsInN1YiI6ImFpLXRlc3QtMVJXNXktIiwiZW1haWwiOiJhaXRlc3RqdEZ4M1NAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQUkiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.Mszghxt5RttHrBBZP2gtZFTpb5znu_3ys-wAE5rQZf_xdh9Q6KDuRyK_tXkJ21HVy-emfPaETUgdHuzpfyfPD34hp9gfiVo_0PtmnESOwNFrJ5vQOE9lf7JwQg_X2ps0lOHFKmg4PKaU0Jv5xS4nRdwzdTcVeOIe6A2nkwbPvTcTu9Jh997TnDfebpQ-um2JkdWCifemqsl1H3m4bP6mWfxkvzLqYxblg-5a0LyD56G-9nNfKtA_gTU341zaTMaoocRcZda4SOXPkioktByC5fZILs0b10wF5EvennJmuF4q_GubsiJ5P-woXpWwEJOsAxy5gWks-jrpgkb89397sA", "refresh_token": "eyJzdWIiOiJhaS10ZXN0LTFSVzV5LSIsImVtYWlsIjoiYWl0ZXN0anRGeDNTQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkFJIiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-01-30 01:36:50
He23DpN1ujpsql2mmn_6mIfEoGxSonag	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T20:51:07.137Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769291467, "iat": 1769287867, "iss": "https://test-mock-oidc.replit.app/", "jti": "7894a4dba5c7794370b9a1ca445c9080", "sub": "combat-persist-9lbhND", "email": "combatpersistkHGX2A@example.com", "auth_time": 1769287867, "last_name": "Test", "first_name": "Persist"}, "expires_at": 1769291467, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5Mjg3ODY3LCJleHAiOjE3NjkyOTE0NjcsInN1YiI6ImNvbWJhdC1wZXJzaXN0LTlsYmhORCIsImVtYWlsIjoiY29tYmF0cGVyc2lzdGtIR1gyQUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJQZXJzaXN0IiwibGFzdF9uYW1lIjoiVGVzdCJ9.mCF4W7bfQz7OseQ7gUmpA3XkcRWYqsrm7MCh54g6X7PlaGuM7YkaxIN8e9zjxB7-2nyK0QjdbdX-M_krkZdBzMh_OCGzx2vJjvAgG-BN9qAWwnJFdIHbYx2cmNX1CzMZ6ccYjWbYsboFeIE0-znhp1RXENjMl0oIWgtPuEoGpGsVK-mAJ70a1tq4FwnF0-F1RykTf6NSvNUG675EMadrc4UwvpLIJmIWwVtipG9P6WxNPXTDeizKNkjhDesJR7DBZ4m4XCvgcBdrvv85N5fY7VtU-HmJKsfRaULxCCV7kmH8d5LJ5HBTAly-KGDDGyJkBfT89jASJOsjSDhMWql3Qw", "refresh_token": "eyJzdWIiOiJjb21iYXQtcGVyc2lzdC05bGJoTkQiLCJlbWFpbCI6ImNvbWJhdHBlcnNpc3RrSEdYMkFAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiUGVyc2lzdCIsImxhc3RfbmFtZSI6IlRlc3QifQ"}}}	2026-01-31 20:58:41
BW8KjgPhNYxBGp3EHGxys_vmP_Md6YoF	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T19:59:46.697Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769288386, "iat": 1769284786, "iss": "https://test-mock-oidc.replit.app/", "jti": "1e4bbc8b3ad28784f403449b432a61e6", "sub": "test-player-combat-crTWix", "email": "playerO_jhO4@example.com", "auth_time": 1769284786, "last_name": "Tester", "first_name": "Combat"}, "expires_at": 1769288386, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5Mjg0Nzg2LCJleHAiOjE3NjkyODgzODYsInN1YiI6InRlc3QtcGxheWVyLWNvbWJhdC1jclRXaXgiLCJlbWFpbCI6InBsYXllck9famhPNEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJDb21iYXQiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.FCrtDQWmMkT4woBdZQslgi72yhJIfT5dUN2cUe1cdWlnJfCsvpnvh7yecM0sTFk9EqtFCdd5ixTNZ-cWiBWdXAaNIqlJqH1W9auxPjUAR3KxHp4wgmiC_CFF5maRcBygp3fP-jbGIAIKChTXB3Rt1YlbyfD9ViDnrgwkYw7yBgmWXrVb52IzvX3rT0ELKRVeKUXAdmQ8er7cRqri03QgslLkPN5cGQHeq6xD_5ah-2hRaPOWqMyuZRNewJt27s3x3ofClXK9Z_XTjbEGMaHwhSkqXTh6-4YlPKdiEtQpV6l4tPKfVRm5vrk87w6cFh2gvPsxql1r199RCT0x48ZWbQ", "refresh_token": "eyJzdWIiOiJ0ZXN0LXBsYXllci1jb21iYXQtY3JUV2l4IiwiZW1haWwiOiJwbGF5ZXJPX2poTzRAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ29tYmF0IiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-01-31 20:02:31
dPylH6dWejiTqL2hAhmfi85F2Pg9sPwv	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:34:11.548Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769628851, "iat": 1769625251, "iss": "https://test-mock-oidc.replit.app/", "jti": "71e44c31c20482e43b184b9a8985dc9a", "sub": "manual-guest-wpwX", "email": "manualguestABbA@test.com", "auth_time": 1769625251, "last_name": "Guest", "first_name": "Manual"}, "expires_at": 1769628851, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI1MjUxLCJleHAiOjE3Njk2Mjg4NTEsInN1YiI6Im1hbnVhbC1ndWVzdC13cHdYIiwiZW1haWwiOiJtYW51YWxndWVzdEFCYkFAdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiTWFudWFsIiwibGFzdF9uYW1lIjoiR3Vlc3QifQ.tDG9pyWLkek2R4Y66v4Ohm16X2paRkQzJP_RrBYkxostBAF_tVkToPg06PWpS7C2ienOheE5StNWaWrvNRzw27lrsssqJYdv5Z4Q-UEKPN-e0cdQJK0YW3mhtwhRCZHpiGChXtX7czwvZ8AHSHAS9DTOGBWy11gDc1EHg-T-uXkxBgz7tVC9KRJnyvZOJ1xqm8lAqoPDO1ovSgZW-_nFy21W8uZTMfHrKYosWFWavhryNRNac6MzGBmSNXoSolnKAEji_jopy1aaz4Khu-I2zgY98sDlqj2PhkwOoAvPeYn-L0QLVkcrl5fSNzVSwuE0iUp4qOQB1RQgdtacmfDWUQ", "refresh_token": "eyJzdWIiOiJtYW51YWwtZ3Vlc3Qtd3B3WCIsImVtYWlsIjoibWFudWFsZ3Vlc3RBQmJBQHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6Ik1hbnVhbCIsImxhc3RfbmFtZSI6Ikd1ZXN0In0"}}}	2026-02-04 18:39:52
Ou3rLDK43lRBlDPTNBeypX4gyWl32jKz	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:20:22.645Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769628022, "iat": 1769624422, "iss": "https://test-mock-oidc.replit.app/", "jti": "9c4d697caf69ee862b3a3e66ca762025", "sub": "host-${nanoid(4)}", "email": "host${nanoid(4)}@test.com", "auth_time": 1769624422, "last_name": "Player", "first_name": "Host"}, "expires_at": 1769628022, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI0NDIyLCJleHAiOjE3Njk2MjgwMjIsInN1YiI6Imhvc3QtJHtuYW5vaWQoNCl9IiwiZW1haWwiOiJob3N0JHtuYW5vaWQoNCl9QHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6Ikhvc3QiLCJsYXN0X25hbWUiOiJQbGF5ZXIifQ.pKhXqxCDKxYpYffaJN79huQcovjVr-p6TcO7k62u0_ZCrOipCEs-FXGEweneYdEHzw-5ivWRZflC1IsqgghJd41ejAnnTpNU-Q3kqM-gdt6758k6_WxwYeuffW8qiPSeRgHMfi2QV6N4acAgTffir9wcKty9tVSYoFjO3KnpxbqtPlzEyUUSpBFO7nuGkSEtBbC0kboohWSFVvhCWmSFY7fDSOqvFGQvmji_m1RHYcobsWBjbLY3olpezXOO0NjAK-dMpImbze2oH5Z3xNV3pXWdhd783OPLM0fJt8ITqVgHjr4xVlzUJ2CNJ8ua_W1UVJJeQ5sfQo5n5C0SKpfMZw", "refresh_token": "eyJzdWIiOiJob3N0LSR7bmFub2lkKDQpfSIsImVtYWlsIjoiaG9zdCR7bmFub2lkKDQpfUB0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJIb3N0IiwibGFzdF9uYW1lIjoiUGxheWVyIn0"}}}	2026-02-04 18:20:32
aEOrAccVtWs2vV0e5E0leRDwrLux5gq1	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:25:04.465Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769135104, "iat": 1769131504, "iss": "https://test-mock-oidc.replit.app/", "jti": "7f8657e8af0681ae5b6b7a27516e65a1", "sub": "test-user-BISmbK", "email": "testplayerUUeuWp@example.com", "auth_time": 1769131504, "last_name": "Player", "first_name": "Test"}, "expires_at": 1769135104, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMxNTA0LCJleHAiOjE3NjkxMzUxMDQsInN1YiI6InRlc3QtdXNlci1CSVNtYksiLCJlbWFpbCI6InRlc3RwbGF5ZXJVVWV1V3BAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiVGVzdCIsImxhc3RfbmFtZSI6IlBsYXllciJ9.N0VxyQnQ6zhiNM6gIS0VgNZNrsCgega98iFfDPgFTtdLAsLjBzLk3Io-rF7YmLRrWQNrs1PmkZDM4fHBD18OktDD7GF3QqZ63r3jR6gOsIN6yn78J2oZBt3AgpPRNBfN1Qmpm5Us1gBncHSg5VZv83ibHBSfQxCAafd0AJCzBI-ptmiQRtlNgbaFGyE9eCs9_0dE8FW8bcXNqWn6otehubBoRsDW01ud4FglUI4ISOQyxWThYGb_HIZ9ASvvRV3catPJM1UCWUr7owSxk3zxtVLWMRY6RFEe3oJogCr9UxeEvfNvcNTapeJ9vuAhFL0Fn4o7H3eJj2RAWIbAf2jOYQ", "refresh_token": "eyJzdWIiOiJ0ZXN0LXVzZXItQklTbWJLIiwiZW1haWwiOiJ0ZXN0cGxheWVyVVVldVdwQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJQbGF5ZXIifQ"}}}	2026-01-30 01:25:12
8bOSf457ngcnx7S-pMXnsDNj-ZeYE-CB	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:11:58.452Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769627518, "iat": 1769623918, "iss": "https://test-mock-oidc.replit.app/", "jti": "a52d008b3ef2aecff16a46180aae354d", "sub": "game-p2-s_bYcR", "email": "gamep2-dwGqRX@test.com", "auth_time": 1769623918, "last_name": "Guest", "first_name": "Bob"}, "expires_at": 1769627518, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjIzOTE4LCJleHAiOjE3Njk2Mjc1MTgsInN1YiI6ImdhbWUtcDItc19iWWNSIiwiZW1haWwiOiJnYW1lcDItZHdHcVJYQHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6IkJvYiIsImxhc3RfbmFtZSI6Ikd1ZXN0In0.Uqd7zTRwsnWw2GcvSbEhcHat4hRJnQC1X8DY55-_USS0na1TBH4KsvZlHkuPi5vZaymLod7ByGTLuo32h0bl6bMGGfXxLCMyXbmQDPNvoW4bbvKT329DO8PmCKv-o3-yOesOuvlSoiGgQzdGxL0kqTd6-kzz1mKmnyvyDhvy_RoSPy1eRls3gQbHYXrm7k5tiapjce_xNisns7TrrAJAN7s9254_J5-G5E-U3yuckj672HvpRMP3fHhk448crsW-NemTcHzyWYllOrJmJk9c7zb_Crr2ywLvUBX_FoZ1zhkWqmRIoZTe9pIUAHF3qfe59OO_iX78s-cVOlfIKXNzuw", "refresh_token": "eyJzdWIiOiJnYW1lLXAyLXNfYlljUiIsImVtYWlsIjoiZ2FtZXAyLWR3R3FSWEB0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJCb2IiLCJsYXN0X25hbWUiOiJHdWVzdCJ9"}}}	2026-02-04 18:19:21
O9SMSlEyYuGG5IQdGsOsDOJdKtGqOlKF	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-01T15:15:55.648Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769357755, "iat": 1769354155, "iss": "https://test-mock-oidc.replit.app/", "jti": "709b31bb17c64527a3416470f9571daf", "sub": "test-user-combat-log", "email": "testcombat@example.com", "auth_time": 1769354155, "last_name": "User", "first_name": "Test"}, "expires_at": 1769357755, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MzU0MTU1LCJleHAiOjE3NjkzNTc3NTUsInN1YiI6InRlc3QtdXNlci1jb21iYXQtbG9nIiwiZW1haWwiOiJ0ZXN0Y29tYmF0QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJVc2VyIn0.yc2d2r_MCTWzCLrh51HKqQrpopm5sz7bgkQ5pmiu4RO7aTleRxy3iGK_RILplWESSL-8UikMuel76b4ZturGev2bOhGttMJuYAfWvx3pbBWk_1VextGjIDNL0Js-UmhPvUdLVj12Uh4IXVYKcsIz7v1u_wylIFjS6uGWBVBar0qAOrs6rbEELTJj2uE3MWaRgxSTiVLtGdXDQEAUwqxZr3bb3fKTx6QJG0PEQjGIXIDp4pAbx3KgUyhgpGbBAPUldWTsMoC1EhvHkOp_7n32FvqU_4EKIl5vNbi6DsgHV1ZKzRAJZmlYSlcDWCE3Z5tKxR2wdoBdyLLdcEQNBnFDCw", "refresh_token": "eyJzdWIiOiJ0ZXN0LXVzZXItY29tYmF0LWxvZyIsImVtYWlsIjoidGVzdGNvbWJhdEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJUZXN0IiwibGFzdF9uYW1lIjoiVXNlciJ9"}}}	2026-02-01 15:16:05
rQQJ9DRYRqWnpMb8lNkoYFi9UIbq1OgL	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:08:26.725Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769627306, "iat": 1769623706, "iss": "https://test-mock-oidc.replit.app/", "jti": "434995b514795de61a49838043b02b2c", "sub": "game-p1-sIqsYX", "email": "gamep1-z5mobm@test.com", "auth_time": 1769623706, "last_name": "Host", "first_name": "Alice"}, "expires_at": 1769627306, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjIzNzA2LCJleHAiOjE3Njk2MjczMDYsInN1YiI6ImdhbWUtcDEtc0lxc1lYIiwiZW1haWwiOiJnYW1lcDEtejVtb2JtQHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6IkFsaWNlIiwibGFzdF9uYW1lIjoiSG9zdCJ9.qd357Rcs83ZO2SqEckkLeR4omW1hPv_oEvj-g1sjlx89j1ajYiCN2QgTwBJ5MSt_9a4zHwdPtNMzkvZMkJDtRvF8T6UwjcJGnEpUjoieqEWjYSEEq_3rqx2wabh6MsbwAg_emNZjnwjKmxGp7F7Y_jYfZJ4E-qrnM8Vefs0UAI961TYVCcMxa0dpXkF-8bZcLPuVwiXrgFcEiN3moRRJ4q1aYxV5qtorakM_rHdKIVUZjRE1rmUc9i_eiQVtWCLYt8xGFUVURcKk2WqSKNb-UnUWwD9VtTnJj5hH-uMjNsQJQWHuKC0Qkfkgeotlyf_u5lPZlYiuzFSNCxbHrHpOtQ", "refresh_token": "eyJzdWIiOiJnYW1lLXAxLXNJcXNZWCIsImVtYWlsIjoiZ2FtZXAxLXo1bW9ibUB0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJBbGljZSIsImxhc3RfbmFtZSI6Ikhvc3QifQ"}}}	2026-02-04 18:18:43
9KhDUaKZhhXDdjLUpnn_bzFKpDLMrDHk	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:00:40.128Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769626840, "iat": 1769623240, "iss": "https://test-mock-oidc.replit.app/", "jti": "879708b633d3d5f8f83aa0b515f0b337", "sub": "mp-player-2-biq3Sx", "email": "mpplayer2-rpAU5G@test.com", "auth_time": 1769623240, "last_name": "Two", "first_name": "Player"}, "expires_at": 1769626840, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjIzMjQwLCJleHAiOjE3Njk2MjY4NDAsInN1YiI6Im1wLXBsYXllci0yLWJpcTNTeCIsImVtYWlsIjoibXBwbGF5ZXIyLXJwQVU1R0B0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJQbGF5ZXIiLCJsYXN0X25hbWUiOiJUd28ifQ.ahIVrJ1VxKFq6Wd-TaVMDWAOIwOMvhOk0IcNf15i5RxjO18I-CnFIbuYt-D5mRycPpHLYYAK0ttiPI__ads6GIsz3r63b8C8BMY1lQjX2AFbD3pajTpC_aQjVd83p022BuvMC80POf9jarr2vFXEQfdYjTUCdZwJB1XnMyDofqoFaAQZ2fAYEkmDv5zm-CRJtYPzMnzLlTBSqffw71nwLA9mufH91AWWsXEO7Q7sWrcS90vhiQzamZqU3-zKvKHWWudVvkJt1QSFJ7NuEoxVzFUHNe-xA7MvfcfxlRF1zADSnrbMmffpbaCiawzYVqPM7DFCOPs0QO3wmjzOeG7Upg", "refresh_token": "eyJzdWIiOiJtcC1wbGF5ZXItMi1iaXEzU3giLCJlbWFpbCI6Im1wcGxheWVyMi1ycEFVNUdAdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiUGxheWVyIiwibGFzdF9uYW1lIjoiVHdvIn0"}}}	2026-02-04 18:07:06
XkfqPmW5I1TFOkFCQQUNL95UhDdAxuat	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T01:53:05.325Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769223185, "iat": 1769219585, "iss": "https://test-mock-oidc.replit.app/", "jti": "b973e0498cf2f24648c86e7695bc19e8", "sub": "testflow-CpGoAC", "email": "testflow6vMmsL@example.com", "auth_time": 1769219585, "last_name": "Test", "first_name": "Flow"}, "expires_at": 1769223185, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MjE5NTg1LCJleHAiOjE3NjkyMjMxODUsInN1YiI6InRlc3RmbG93LUNwR29BQyIsImVtYWlsIjoidGVzdGZsb3c2dk1tc0xAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiRmxvdyIsImxhc3RfbmFtZSI6IlRlc3QifQ.BFoPlYgZMyYzb_9jyA5ucNnuhPvdUYYaZLD6XheUH1Dsbt_y6bblPfym6w00ulSSrQmPxLXTUIucSbDQ0G0ts7PVeOUdh5g0L_eidq8lU5ZcFE8LNIe3OFM-SBAiNou_WAffv6rrRJZTdfi3uIAmhhrmnOAYe_GI2plQvyHeLtgj3j8o_EveAuugPnlLSMbNfyei2ZSobp9f1MX8kgaGrzJLCJsaj59RjHJzpHZfFrfRMPrbscQVpiRzFpMyxlD8GVWhStZaWwmKfWz_f_09aToQ6Yv-50gYOP_v-8YGXtrf89LWVH-YHE7ji7AUF-yA-ADVuQTHMs4GjDWt5EFNSg", "refresh_token": "eyJzdWIiOiJ0ZXN0Zmxvdy1DcEdvQUMiLCJlbWFpbCI6InRlc3RmbG93NnZNbXNMQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkZsb3ciLCJsYXN0X25hbWUiOiJUZXN0In0"}}}	2026-01-31 01:57:33
54NV8pswlnG-2Q3broyqM_aPh5SVHfj1	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:17:48.439Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769627868, "iat": 1769624268, "iss": "https://test-mock-oidc.replit.app/", "jti": "627ea96914c1cac852053d952d44e4ab", "sub": "spectator-OJaXfB", "email": "spectator-gMqjCX@test.com", "auth_time": 1769624268, "last_name": "Watcher", "first_name": "Charlie"}, "expires_at": 1769627868, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI0MjY4LCJleHAiOjE3Njk2Mjc4NjgsInN1YiI6InNwZWN0YXRvci1PSmFYZkIiLCJlbWFpbCI6InNwZWN0YXRvci1nTXFqQ1hAdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiQ2hhcmxpZSIsImxhc3RfbmFtZSI6IldhdGNoZXIifQ.t-aJs7A_PuoeBs692hkl3ZNkeU0l3DhzJoqLoF7qmFCnfRBKz9N_aJBOFobLZ-Emf2GAlieZSAMrXUIzhnDWpFthy3HGU3XhQigAIheGLGKjal2gEy_iKZMuhgX6q5HkOHHtz8vbpBTKAPYkvOvSI1cSTzvhJ0M2N03tEGPuGf4LWpakZtW4Yzyd22t7JMaTx8CzoacbShcn22qqYToK0MJ6B-b9r2nCmVyXzsVjkL3gCr6UVMICZ7MGszn_NTaRR04n-ALUOQZTuSeZFutVyGmCn-6xe9vGRPQtyEZd8_ZqGW2i-89G7sa5SSJvx_k6iNKse4DyBQ21lE7KU4XIiw", "refresh_token": "eyJzdWIiOiJzcGVjdGF0b3ItT0phWGZCIiwiZW1haWwiOiJzcGVjdGF0b3ItZ01xakNYQHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6IkNoYXJsaWUiLCJsYXN0X25hbWUiOiJXYXRjaGVyIn0"}}}	2026-02-04 18:19:22
jA49806bRPp5m9LZ1WudEr_79SDyjhMa	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T19:05:14.499Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769198714, "iat": 1769195114, "iss": "https://test-mock-oidc.replit.app/", "jti": "18ccc21b5c3adb078e723e5d814d8089", "sub": "test-vw-CzfG1Y", "email": "testvw-GFz8X@example.com", "auth_time": 1769195114, "last_name": "User", "first_name": "Test"}, "expires_at": 1769198714, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTk1MTE0LCJleHAiOjE3NjkxOTg3MTQsInN1YiI6InRlc3QtdnctQ3pmRzFZIiwiZW1haWwiOiJ0ZXN0dnctR0Z6OFhAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiVGVzdCIsImxhc3RfbmFtZSI6IlVzZXIifQ.XWCJGWPt7--2dpYt8meeqwrhaAW5Oe6tL_p-ne7WyM4hTh21P_0OFjsEPNuAonR8t4571FEbmqmmglU34Gx8rRLMZtpQmKxpabulcZwiTD1JeYkfr0-3r1fAenOl34XiDCWQYEG1w8PFFsDcaYhOh7u98Z9hikPis7rWMOtbaQUAdtmnVDJXlgoPvG0HdGl_642Puqrv1mJodU0Gup8eGzRzPaHrEa5POlrjOlFRrCEvtipUqFpJa7Gjyi9Sa1IMZvqdk_aZGCFfWm-gDreUuBa7smu4FDY6wJ2XBLZ_1NTbCyPhuyQo4630guvADuDieCFzdprWYq6wAePgWvQlkA", "refresh_token": "eyJzdWIiOiJ0ZXN0LXZ3LUN6ZkcxWSIsImVtYWlsIjoidGVzdHZ3LUdGejhYQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJVc2VyIn0"}}}	2026-01-30 19:07:30
Jjy_hxw0yFi9vhBUC2xb2aXRz6zbfQzs	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:38:58.918Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769135938, "iat": 1769132338, "iss": "https://test-mock-oidc.replit.app/", "jti": "ccc97d98623a45f58bbb2a422cf139d4", "sub": "practice-fix-WAcBLc", "email": "practicefixBCaiD5@example.com", "auth_time": 1769132338, "last_name": "Fixer", "first_name": "Practice"}, "expires_at": 1769135938, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMyMzM4LCJleHAiOjE3NjkxMzU5MzgsInN1YiI6InByYWN0aWNlLWZpeC1XQWNCTGMiLCJlbWFpbCI6InByYWN0aWNlZml4QkNhaUQ1QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlByYWN0aWNlIiwibGFzdF9uYW1lIjoiRml4ZXIifQ.Je7tbrRy5JjY3dFLhq25qJjQWBlreVj8OPlLdkpMxbgf2OgzteA4sFmi_TdfoxZWG0GMl2k-SQsYRyWyreh46--aieZim-IZ6GpArDYc12iTVg0ja-edtMAI3eVTlxt1IvRkp2RFNRocsjw4umbqqqFK_DcCmEslzjsddvWvgG2Vi9OYEYL-RRFhLIz3NC9G818gyROwV2h8gL3ksrHyiAgYY7sD8E00-yJo4FacnT4XUCJabCPzjAsUZnfnfKWcZKzA1NSxQmuQpf2sfzqAOlhlU0o7-N15647fpbI0-Vi4mz0N7fbfhelkRz9wvhQF6ZX-jo9VCVnf4ane2A6BpA", "refresh_token": "eyJzdWIiOiJwcmFjdGljZS1maXgtV0FjQkxjIiwiZW1haWwiOiJwcmFjdGljZWZpeEJDYWlENUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJQcmFjdGljZSIsImxhc3RfbmFtZSI6IkZpeGVyIn0"}}}	2026-01-30 01:41:09
r1NN2iTzh2TOHubTsGdmnABkpDGszh9D	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T17:58:59.698Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769626739, "iat": 1769623139, "iss": "https://test-mock-oidc.replit.app/", "jti": "841b78ad8c175811bcf3809c885babed", "sub": "mp-player-1-Ox2bYq", "email": "mpplayer1-bV2syZ@test.com", "auth_time": 1769623139, "last_name": "One", "first_name": "Player"}, "expires_at": 1769626739, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjIzMTM5LCJleHAiOjE3Njk2MjY3MzksInN1YiI6Im1wLXBsYXllci0xLU94MmJZcSIsImVtYWlsIjoibXBwbGF5ZXIxLWJWMnN5WkB0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJQbGF5ZXIiLCJsYXN0X25hbWUiOiJPbmUifQ.gIK16J9E14RgVmu4iIfefjfturA3psuL-k-MsZmOIU1XGkaaq-9vHfC9EAIjYACOl8CmY4HHzHnMCgt5UckZ8Hy96uMCv78O1x9DM0RowX7dqThhY3SFuxIVKjCbu6Y1EHdtg5zb8IfOXdFOGkz0somMJkjHImRHHmYWrLQHU65FzLGthnvMR5xmJTtI2AbVZSM3taSvYI5Gb8sxmewUNI2OghaLDCOIqkNF_wp9mlfr673QWLbU1niy0JpGcKHbcr_tWYsueT3bZzwoef8Ia9aUFY2ExzhE0roxLqss2kov7YNa_L7ZuqWTCCY2pOe3FFcxZHO2X4XjlCSJi8QMvw", "refresh_token": "eyJzdWIiOiJtcC1wbGF5ZXItMS1PeDJiWXEiLCJlbWFpbCI6Im1wcGxheWVyMS1iVjJzeVpAdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiUGxheWVyIiwibGFzdF9uYW1lIjoiT25lIn0"}}}	2026-02-04 18:07:06
eymb533o027mbOQA9eyT5tEIAkvP-4yV	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T19:10:25.290Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769199025, "iat": 1769195425, "iss": "https://test-mock-oidc.replit.app/", "jti": "c2716bcaae082bb7f9c1127f26879cfd", "sub": "testsimple-as0uhb", "email": "testsimpleDn3Qee@example.com", "auth_time": 1769195425, "last_name": "User", "first_name": "Simple"}, "expires_at": 1769199025, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTk1NDI1LCJleHAiOjE3NjkxOTkwMjUsInN1YiI6InRlc3RzaW1wbGUtYXMwdWhiIiwiZW1haWwiOiJ0ZXN0c2ltcGxlRG4zUWVlQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlNpbXBsZSIsImxhc3RfbmFtZSI6IlVzZXIifQ.IaO2KMexEKnn3Y9LK38V5l2Xl9L8TzBbVVOsyESN0A8fLPUfbHMspngi1yMx15oFLzKLRY-GtPvI1vg6P9rd1ElYCTz7IkJZhqaoSTF95eP5QQVqZr9dipcDecNDv3lcWgcSDdKVe3DDiIkC9ZTS5hMujbDDPZwXG9gUBrXpMOquzHOzHjWoGeIrOjWZ47NJygek7GSYV-8DseZJkvps9uudV9Vyy4xJbQxPcQ4_BN6e3kQDBsVCGoj2SL2nDfBtJ29JLgLoawnxIfI8Soz1A-goGvGXLOk9xvK5yhuWRtcdCdsp8lAcKMlPvPiaoQDwVntlixHLCMVJnm-MZwHcGw", "refresh_token": "eyJzdWIiOiJ0ZXN0c2ltcGxlLWFzMHVoYiIsImVtYWlsIjoidGVzdHNpbXBsZURuM1FlZUBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJTaW1wbGUiLCJsYXN0X25hbWUiOiJVc2VyIn0"}}}	2026-01-30 19:10:37
dS8s4AbaCVFvp-lHfoP_TPI4ZJSFWut7	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:51:57.899Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769136717, "iat": 1769133117, "iss": "https://test-mock-oidc.replit.app/", "jti": "dc24deff9488246abfb5cfdebc4e9169", "sub": "card-click-xwqxPP", "email": "cardclickSoeZYu@example.com", "auth_time": 1769133117, "last_name": "Clicker", "first_name": "Card"}, "expires_at": 1769136717, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMzMTE3LCJleHAiOjE3NjkxMzY3MTcsInN1YiI6ImNhcmQtY2xpY2steHdxeFBQIiwiZW1haWwiOiJjYXJkY2xpY2tTb2VaWXVAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ2FyZCIsImxhc3RfbmFtZSI6IkNsaWNrZXIifQ.r3beUu9LvBhODiJ-0rayvA3TeS6THKhM_RApJvIKRe8GQbdasCDCPPp0GFmsfZz0k0j_iYkDt1b2t3Heqykv_iQm2q-k9P5izacvl5FmIR_wEb-mFj0b4DpyfiapUYOaCgmVgLxybBLzUEagHug7BOPzi4u8PElKnkT7la2VrzTBZ6dBhfktGdMNaKIuTfl0-lRJYfwQcrF9-SIjEJm3f-WgjhzyV_p1mxljvrjQ9ZpNmEplIQCRrs5wIZWoXzD_mE9V8Y9iCjR5G0FL-ci9cRaK4JR8dqHVDLKEPaFfhPxrBIW8Vw-qSyP8RGB93OlRVwRQ3eSvr39YIYv9LK6Iug", "refresh_token": "eyJzdWIiOiJjYXJkLWNsaWNrLXh3cXhQUCIsImVtYWlsIjoiY2FyZGNsaWNrU29lWll1QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkNhcmQiLCJsYXN0X25hbWUiOiJDbGlja2VyIn0"}}}	2026-01-30 01:53:59
_QYMpAHL6g5LhgGyQh9IO5j-d9dTyptW	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T20:38:13.612Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769290693, "iat": 1769287093, "iss": "https://test-mock-oidc.replit.app/", "jti": "a5cd020bcfa46d39b95d17744e87ede8", "sub": "combat-log-test-bRsWH9", "email": "combatlogSnz-Ow@example.com", "auth_time": 1769287093, "last_name": "Tester", "first_name": "Combat"}, "expires_at": 1769290693, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5Mjg3MDkzLCJleHAiOjE3NjkyOTA2OTMsInN1YiI6ImNvbWJhdC1sb2ctdGVzdC1iUnNXSDkiLCJlbWFpbCI6ImNvbWJhdGxvZ1Nuei1Pd0BleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJDb21iYXQiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.lTd3Jg7ut-EFzqvNqzO5CRdnxjw6gZV4szd3dPFwgoATmCdy5SbY8VElwb0RGKR4CWYYxx_MVDRhY7MN96ZTnFMdu8g52begIEBlFqT46SamDaFFcbKgihbwwYtBaAKDn0KZwxcmUgjxlBNi7Ro48zZS1RlJD15z-1m3EPlOPEO1de4hmAq4TkStnvV9DXNsBz7SUgb42tTUD_ZsAN-g0Xg9IlOoyf0mAR-aZ1g_RCEKI2RHtgBG0gc0YSZ-jTtqhEuaowX2WoncL2SuiR5Zh3ulIqwwPGwqYtrzLE-osC29LxuTEb9tdRymxwHkDWRrS3Hk-hfploqkDVkTDidkOg", "refresh_token": "eyJzdWIiOiJjb21iYXQtbG9nLXRlc3QtYlJzV0g5IiwiZW1haWwiOiJjb21iYXRsb2dTbnotT3dAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ29tYmF0IiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-01-31 20:46:57
1UPN2cE8sCAXTVm32htMWXt8o7J5OFop	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:43:40.258Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769136220, "iat": 1769132620, "iss": "https://test-mock-oidc.replit.app/", "jti": "5d5e5fa8a4abe08f829ecfce7ddae1ec", "sub": "final-test-5PBFIL", "email": "finaltestRTU_oT@example.com", "auth_time": 1769132620, "last_name": "Test", "first_name": "Final"}, "expires_at": 1769136220, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMyNjIwLCJleHAiOjE3NjkxMzYyMjAsInN1YiI6ImZpbmFsLXRlc3QtNVBCRklMIiwiZW1haWwiOiJmaW5hbHRlc3RSVFVfb1RAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiRmluYWwiLCJsYXN0X25hbWUiOiJUZXN0In0.Rxawsc7DLlUxJ097p31ZNV0UhgjufexPcuvOoZDjV-qw6FpvHhjO2eztn0dJF9qDi63u3TJYjPmr39rwHCzIqvnMeg8CD-48Yw5u-Sffo-oVqwcFYLbsERPTX05poBergS7SnrkixsKvrYBhYsC2bPUEWIC6MVHFQebhfAj642A1OT69PfDWiUAjJ7Sn4E8iiVEUHcKQ3j7Q2z8x9WM1OgI4otOf40UBFSiVJu-DKxk5S1r2TtcDSH89yjJ9etEdNcav48vbP-jwNHveDOqbs-Hvo8At5Y16zqgbtAUG05iMYjPrcrYR7WrVbNQTYGH3Kfkr24H8CWDmXJk-kqbY2w", "refresh_token": "eyJzdWIiOiJmaW5hbC10ZXN0LTVQQkZJTCIsImVtYWlsIjoiZmluYWx0ZXN0UlRVX29UQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkZpbmFsIiwibGFzdF9uYW1lIjoiVGVzdCJ9"}}}	2026-01-30 01:50:04
cPjrFPfjniXI6r-NpcY8Q77eDBuv2vL1	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:23:26.140Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769628206, "iat": 1769624606, "iss": "https://test-mock-oidc.replit.app/", "jti": "7a51a83d22475f45ecfccd24e370c0fa", "sub": "manual-host-${nanoid(4)}", "email": "manualhost${nanoid(4)}@test.com", "auth_time": 1769624605, "last_name": "Host", "first_name": "Manual"}, "expires_at": 1769628206, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI0NjA2LCJleHAiOjE3Njk2MjgyMDYsInN1YiI6Im1hbnVhbC1ob3N0LSR7bmFub2lkKDQpfSIsImVtYWlsIjoibWFudWFsaG9zdCR7bmFub2lkKDQpfUB0ZXN0LmNvbSIsImZpcnN0X25hbWUiOiJNYW51YWwiLCJsYXN0X25hbWUiOiJIb3N0In0.xQzmaGVU9mWrmp19ULF1UTE7wEPpA3kwFOfrzTJgjZZfiXOAMAr0gSthc3Fr-R5SReWEccedc3KTBDbzWR8bP_4hrEq2gCV4Df4WkEtu54AHtKG15ZSYIsBX5wRchbY6ZBgZNKAVxL3ip3eftSn4AJBWqSTjP_Bc09nfJ3t7ye-JIIMwtgiyzpk9AO54Anxv6y5POL594xGdmdYXtFDAyTusauVVCnaOuG-_zpLLmT1C9Gl2z2Egp00c9jut99WZEEEpE8CAjMBr40klCfNE_TMP8lykkSmVyvykajVDZoZVnAWt6eyi4HpYAweBR8TUcPxqka_RKpi4wYgHN3pPwQ", "refresh_token": "eyJzdWIiOiJtYW51YWwtaG9zdC0ke25hbm9pZCg0KX0iLCJlbWFpbCI6Im1hbnVhbGhvc3Qke25hbm9pZCg0KX1AdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiTWFudWFsIiwibGFzdF9uYW1lIjoiSG9zdCJ9"}}}	2026-02-04 18:39:52
kqQOAnfvYTPE9_qg26EP2YlzOw6R0wnU	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T18:56:23.920Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769630183, "iat": 1769626583, "iss": "https://test-mock-oidc.replit.app/", "jti": "9f4c65a656a7635f03885def7ecaedec", "sub": "test-user-mp-p5q2Yd", "email": "mptestXvs2E0@example.com", "auth_time": 1769626583, "last_name": "Tester", "first_name": "Multiplayer"}, "expires_at": 1769630183, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI2NTgzLCJleHAiOjE3Njk2MzAxODMsInN1YiI6InRlc3QtdXNlci1tcC1wNXEyWWQiLCJlbWFpbCI6Im1wdGVzdFh2czJFMEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJNdWx0aXBsYXllciIsImxhc3RfbmFtZSI6IlRlc3RlciJ9.g5-5fgkQKz9R7vV1zYiva3Aj7t8PR2jnWfRggbSorMrnkFSFRiOzr4sGZTcSau6zcJcH3dxkWSr02QdJgGoUX_HtGTDjPmv_T08N-sqj1G7lauCxbJfdDIHLhVjs-AqQagemThR-PWzKIT-fJi-oOPHJhYitUY25cxzEZdwqtYF6dWHKMF9A4wSoWLcvFI3Kw6aXwFCiA0BRM4PnW1yjVX6DIfVz3pe0dt1lsrxqi7UlDBqqTVM-xeUIfUwBkDQhi7dFRMdFrn73Qh70aD1ZBGCardw2JAQPmnqel1D1JC4icik-JX7MaZcL8PZPXrbqxk6WipF5kgs4FbLgfFD19Q", "refresh_token": "eyJzdWIiOiJ0ZXN0LXVzZXItbXAtcDVxMllkIiwiZW1haWwiOiJtcHRlc3RYdnMyRTBAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiTXVsdGlwbGF5ZXIiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ"}}}	2026-02-04 19:00:19
hqpT_lvfxYPLpge7pAvZip1rzH_slV2z	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-30T01:26:53.357Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769135213, "iat": 1769131613, "iss": "https://test-mock-oidc.replit.app/", "jti": "f497c48fd475eca5532f1bc9f13e81f1", "sub": "test-practice-enmYch", "email": "testpracticeDtKNsQ@example.com", "auth_time": 1769131613, "last_name": "Tester", "first_name": "Practice"}, "expires_at": 1769135213, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MTMxNjEzLCJleHAiOjE3NjkxMzUyMTMsInN1YiI6InRlc3QtcHJhY3RpY2UtZW5tWWNoIiwiZW1haWwiOiJ0ZXN0cHJhY3RpY2VEdEtOc1FAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiUHJhY3RpY2UiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.Ls98ISINQ_F0CWnVrt1qjeoJaVMkyhKxNZDG534XUnKx-O4h5hrQoL1s9ziIhMsYRM_pgFCaaTdzTNQwcKh9npSwil4lALYvX8_BbaSFeScplLpy55-8W8dNAx6sP9pv6AouoJXVIrl8ZYH2xdGh6eKn35F657Ehn3uFzgS1Lp2crr5FhPyajHebq2L-d3Yk7zMEXdOkJ5XZUaAw67mp8f46-dXEyFxrfM5Fy6oI2jpfWH8D_Al5BTkag9Y5L59cPIXaznSAmNEuXF6qhTJs99cqLWDOIGIjT7de2s9xA3aq8tZ0MTJDZGGtwS0IOL-h99qrdjM6rU_iu2ocvqwTXQ", "refresh_token": "eyJzdWIiOiJ0ZXN0LXByYWN0aWNlLWVubVljaCIsImVtYWlsIjoidGVzdHByYWN0aWNlRHRLTnNRQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlByYWN0aWNlIiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-01-30 01:29:43
-d0WahfnpKHYZhMs-swvRqlHHQV2Lg5e	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T01:49:39.503Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769222979, "iat": 1769219379, "iss": "https://test-mock-oidc.replit.app/", "jti": "a58552283026552c928f824c84c96a87", "sub": "testai-ve19Xr", "email": "testaipyJhnt@example.com", "auth_time": 1769219379, "last_name": "AI", "first_name": "Test"}, "expires_at": 1769222979, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MjE5Mzc5LCJleHAiOjE3NjkyMjI5NzksInN1YiI6InRlc3RhaS12ZTE5WHIiLCJlbWFpbCI6InRlc3RhaXB5SmhudEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJUZXN0IiwibGFzdF9uYW1lIjoiQUkifQ.nc6zV_Y2AxMoUQ179tiWc_hOsILSzPQbYXO_SXvRD1ug2m4wrVOczvRk1jzznrfjzHeXOHvZSY5KVXifXZ8MED5VNpDNe7SpGcS9SAOXwGjQrjfnxTypA5m3rg2zlNxcPXbE87qtmQ15O-2zROCctek0i-3Ws5IJpCUVqG7q6hTQepClu74bWAc2SBHModXZu0lMAovDzv9Ol5_RCoKtuZwQ8ImcFvBxxBZsAIlQcL_2IEvwos8dZNA-AzmQ-_0oTFhnjk2lBCOsHL0KPOzKHFNX61OtTXDGR4vDmd2VneO0CouR7ni-xhAp8HLz3JRz7ix2AJRUSEKkefrzmxGV9Q", "refresh_token": "eyJzdWIiOiJ0ZXN0YWktdmUxOVhyIiwiZW1haWwiOiJ0ZXN0YWlweUpobnRAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiVGVzdCIsImxhc3RfbmFtZSI6IkFJIn0"}}}	2026-01-31 01:50:54
yo-Uo4GGCrFozCPgaIfR4YLI7Uq1Ifvx	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T19:16:18.616Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769631378, "iat": 1769627778, "iss": "https://test-mock-oidc.replit.app/", "jti": "0d0aed04a5594000c49adc6657294f6c", "sub": "mp-test-seed-abc", "email": "mpseeded@example.com", "auth_time": 1769627778, "last_name": "User", "first_name": "Seeded"}, "expires_at": 1769631378, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI3Nzc4LCJleHAiOjE3Njk2MzEzNzgsInN1YiI6Im1wLXRlc3Qtc2VlZC1hYmMiLCJlbWFpbCI6Im1wc2VlZGVkQGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IlNlZWRlZCIsImxhc3RfbmFtZSI6IlVzZXIifQ.KgVEeScWm2Iat4DT8C-FkqBm-9Nb-dAwPOl3l4Z_M9LX6Sqhi2YlesAq0ulyhbTxZunbCRewKj7-sJSE-mD7LIOzexFlTm43ZYGrgU5W8JOpgefX4vQ8pVAQsHwVXY6OMrlqaa3D_jcGAvnv8KYeRM3xoV6dupJXJaN-r7PuH4Lthus0WCQKk-cyfN_YstUT5h81dIlCGnTExH5QvwKHzRqoTJmdPx0s25uVrcK3GV9CRbCYZ7e89amreD8HjFVBo0Ghq9vvFZudJE496bkuhK2z40vIAb4lwpBv3f5FclHT6i4Q2Ldi1X1C4AN86PCxYZSeqvkEVFll6OrAATLxfQ", "refresh_token": "eyJzdWIiOiJtcC10ZXN0LXNlZWQtYWJjIiwiZW1haWwiOiJtcHNlZWRlZEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJTZWVkZWQiLCJsYXN0X25hbWUiOiJVc2VyIn0"}}}	2026-02-04 19:18:00
q6iX_XfkT49tXit7K7h4iRemD4aGwaGk	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-01T15:17:07.749Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769357827, "iat": 1769354227, "iss": "https://test-mock-oidc.replit.app/", "jti": "b6b92bd7db4d63e795700b833052fa12", "sub": "combatlog-test-8WRcg0", "email": "combattestKInI54@example.com", "auth_time": 1769354227, "last_name": "Tester", "first_name": "Combat"}, "expires_at": 1769357827, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5MzU0MjI3LCJleHAiOjE3NjkzNTc4MjcsInN1YiI6ImNvbWJhdGxvZy10ZXN0LThXUmNnMCIsImVtYWlsIjoiY29tYmF0dGVzdEtJbkk1NEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJDb21iYXQiLCJsYXN0X25hbWUiOiJUZXN0ZXIifQ.INxRaFe0eqkfvg6ZIs92JaLJ1iSCTLFAFE28lCI-K0lm48Y8VzewSZ9BwyqNCJMAim7DGlTTO54lDMEHloyoa7b31XUPPL8e8XkgIPlXmLyybBSCTG02pA3k2TrQsyc5HyPY6qdWkdQdxYCg_FvnNZzc7npa78t0bbPxcxGjMmZGs2aU3YrzpxRcp5XnV_fbnAm3DFDN3BrLnzVfG_UT21sY9OBuYdR80ZniL0A_qnDj98tq8R2tr_Hdm4YucNqRJ80tVkk1ELPDi-B6VExRqo5hvnnJHJTEuwcQSO6vUIjeJf6FzQE87fPkplw3_hGKUqYfWpTPRXnr_gcDvamAEQ", "refresh_token": "eyJzdWIiOiJjb21iYXRsb2ctdGVzdC04V1JjZzAiLCJlbWFpbCI6ImNvbWJhdHRlc3RLSW5JNTRAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ29tYmF0IiwibGFzdF9uYW1lIjoiVGVzdGVyIn0"}}}	2026-02-01 15:26:33
IAVQm24eQu6mWyO19CEtdULfU4UOesm-	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T19:02:19.360Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769630539, "iat": 1769626939, "iss": "https://test-mock-oidc.replit.app/", "jti": "a82b9569d9f6b0c30b965d58cd2f75a9", "sub": "test-deck-mWlqHU", "email": "decktest5kSlb8@example.com", "auth_time": 1769626939, "last_name": "Test", "first_name": "Deck"}, "expires_at": 1769630539, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjI2OTM5LCJleHAiOjE3Njk2MzA1MzksInN1YiI6InRlc3QtZGVjay1tV2xxSFUiLCJlbWFpbCI6ImRlY2t0ZXN0NWtTbGI4QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkRlY2siLCJsYXN0X25hbWUiOiJUZXN0In0.B49Sjwsy7i4NOQIwivAmcbwwHLimBPxE72iM_GgGR4OoqRnnEITS7VCHToq8PTxsRUIctrfofXj4WgemN7Eew8lB6SwdevHuOJOu9qdaX_tHK7K9H-K1nIP_UEfBPAItshSkFKkfBuXrHVRNtTJX_l_4EO3TslJAeroqJZASkfUo-ym4-rvgUsUQF9MoOWo2QHc1X7IQsn0EKS6USfwV-V5QtZvQ27BN4VKnQ2A_bl87zYCMqIJ9FSLrOBfF4QacXmnH7vO_nFqqbzM5SjNFVPSYzlchqwTbbKli2V6WA4db21F8psEJBNou7fIxhpdizQLBEKybOO5vNFfh6vFXfA", "refresh_token": "eyJzdWIiOiJ0ZXN0LWRlY2stbVdscUhVIiwiZW1haWwiOiJkZWNrdGVzdDVrU2xiOEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJEZWNrIiwibGFzdF9uYW1lIjoiVGVzdCJ9"}}}	2026-02-04 19:02:30
rlNjQT4vRPNYRTY3aOWfe3x1gpmXNjYp	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T21:00:10.541Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769292010, "iat": 1769288410, "iss": "https://test-mock-oidc.replit.app/", "jti": "98706a19c004b3768a11d63d47b904bc", "sub": "combatlogtest-U24oQ8", "email": "combatlogKjSxFw@example.com", "auth_time": 1769288410, "last_name": "LogTest", "first_name": "Combat"}, "expires_at": 1769292010, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5Mjg4NDEwLCJleHAiOjE3NjkyOTIwMTAsInN1YiI6ImNvbWJhdGxvZ3Rlc3QtVTI0b1E4IiwiZW1haWwiOiJjb21iYXRsb2dLalN4RndAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ29tYmF0IiwibGFzdF9uYW1lIjoiTG9nVGVzdCJ9.vt-LSp8LyDr7cihjiBM2vSKbyFmiz7bCF4OYfyB8mV7JVW18J17F8MaiGF6rsTMP81Rvl2H7vzh4W-COlZHeQpoLVlx5M09__o8MzKhUTgh5RlJMPoHrKKfnADH6AAL-Y4bs6JoTcBWa_9FZglA1k-TkrrE7L97bUCNKI68lUo7P0cb1VEZh6uqdpOGZx6xvJsT77NNhYtBoGVjV1Pcxew6gf57TDwomNwInUBG_ph8xawr3x4M-d1OHui6Kt-3sECFRvWEb8_gGRYG7j_7hbD8Kk9XMHUEp-CWwdHxbqH6sajPEsE727aY5II9gBmCbbxDAhYs_ddo9cuSmRsFDQQ", "refresh_token": "eyJzdWIiOiJjb21iYXRsb2d0ZXN0LVUyNG9ROCIsImVtYWlsIjoiY29tYmF0bG9nS2pTeEZ3QGV4YW1wbGUuY29tIiwiZmlyc3RfbmFtZSI6IkNvbWJhdCIsImxhc3RfbmFtZSI6IkxvZ1Rlc3QifQ"}}}	2026-01-31 21:00:22
gduZ4YkQ9ZPUZ1Pi74Z-Q_t_BCK4T9yu	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-04T17:50:26.479Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769626226, "iat": 1769622626, "iss": "https://test-mock-oidc.replit.app/", "jti": "76ffb05f8de9163a2b41f12fceaceba3", "sub": "test-player-1", "email": "player1@test.com", "auth_time": 1769622625, "last_name": "Player1", "first_name": "Test"}, "expires_at": 1769626226, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5NjIyNjI2LCJleHAiOjE3Njk2MjYyMjYsInN1YiI6InRlc3QtcGxheWVyLTEiLCJlbWFpbCI6InBsYXllcjFAdGVzdC5jb20iLCJmaXJzdF9uYW1lIjoiVGVzdCIsImxhc3RfbmFtZSI6IlBsYXllcjEifQ.kmrypukVyTIShY-AhzF3-dlJrAgoo5dvg1oKr0bjL3H3S5XsqwbQFOZ1hzw0GaHCY79EAQ4aR5JZJ5p5NOZUYZ9dEawXKgFq6e7PkO5XbQ1tmnHNfpvpdIeU2sKkjAQLXTGZUKknzyE3tc-B8E88i550TjKQmAZFdN_fdY_G-B2ziawiLhHBLKE5cI4LwTG3suniVgZiXooweGuumFKdD8cACWTz073-U65ShLAtFosLbDQsUSPSFEATQWYLFIJPG9hp5Pq2-7bzWnGfMboyOXb9ii6wkA1R6IDE-Xf1mANaFR6qZoZ2T9_GQhZM66CQ99jZtEMPMnjbJacD7VTklg", "refresh_token": "eyJzdWIiOiJ0ZXN0LXBsYXllci0xIiwiZW1haWwiOiJwbGF5ZXIxQHRlc3QuY29tIiwiZmlyc3RfbmFtZSI6IlRlc3QiLCJsYXN0X25hbWUiOiJQbGF5ZXIxIn0"}}}	2026-02-04 17:52:11
QyRu3KytSa_5Vg_avwizJ7PSSkxX_nUu	{"cookie": {"path": "/", "secure": true, "expires": "2026-01-31T20:06:37.053Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3fac7dd3-b6fe-421e-afe0-4200271149f8", "exp": 1769288796, "iat": 1769285196, "iss": "https://test-mock-oidc.replit.app/", "jti": "3ed01aa1ba91a353f3b978d93e4a0b89", "sub": "test-combat-_NOGFV", "email": "combattestGwafFP@example.com", "auth_time": 1769285196, "last_name": "Test", "first_name": "Combat"}, "expires_at": 1769288796, "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc4MDgyZTlmZjVhOTA1YjIifQ.eyJpc3MiOiJodHRwczovL3Rlc3QtbW9jay1vaWRjLnJlcGxpdC5hcHAvIiwiaWF0IjoxNzY5Mjg1MTk2LCJleHAiOjE3NjkyODg3OTYsInN1YiI6InRlc3QtY29tYmF0LV9OT0dGViIsImVtYWlsIjoiY29tYmF0dGVzdEd3YWZGUEBleGFtcGxlLmNvbSIsImZpcnN0X25hbWUiOiJDb21iYXQiLCJsYXN0X25hbWUiOiJUZXN0In0.OXA7U3QyNtzQtiCWEQDEDpc4-oZpXEbXUTJNpfPU2h-VaJMNRPfRp0WZQKrL48QMGQGnv_thwqPH3intWmthhnLFbR4oIwYsquH2sisDMosp9l_fwVJM3CCqCIykQMWfCGR3nvHg_-Vcg78xTLSb4DGlwf2hsHJKgXJN8Zho4clcSmIP5pfVQbf-oCyinTXC6vPySpguZ3Dwa5ZqyVaQZrDaehGx28XDEb7wpSeBI6hzVSFcwgWRnE76p-9o_3_lfYek2-hf9C73PoOrTD_fOpFQ2YBMOpHDdLj07eJXpzFyR0U-ZEMZlG4Clj7cIb8dXtxiF0cRsG_whQij-FK3Xg", "refresh_token": "eyJzdWIiOiJ0ZXN0LWNvbWJhdC1fTk9HRlYiLCJlbWFpbCI6ImNvbWJhdHRlc3RHd2FmRlBAZXhhbXBsZS5jb20iLCJmaXJzdF9uYW1lIjoiQ29tYmF0IiwibGFzdF9uYW1lIjoiVGVzdCJ9"}}}	2026-01-31 20:08:37
\.


--
-- Data for Name: user_decks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_decks (id, user_id, name, commander_id, card_ids, created_at, updated_at) FROM stdin;
61a441af-2db1-40c7-a6bf-f7e9e73ef827	50128681	JWM	commander-air	{card-air-1-2,card-air-1-2,card-air-1-2,card-air-1-3,card-air-2-3,card-air-2-3,card-air-2-3,card-air-2-1,card-air-4-2,card-air-4-2,card-air-4-2,card-air-4-1,card-air-5-2,card-air-5-2,card-air-5-2,card-air-5-3,card-air-6-0,card-air-6-0,card-air-6-0,card-air-6-3,card-air-7-1,card-air-7-1,card-air-7-1,card-air-7-2,card-air-8-0,card-air-8-0,card-air-8-0,card-air-8-1,card-air-9-3,card-air-9-3,card-air-9-3,card-air-9-2,card-air-10-3,card-air-10-3,card-air-10-3,card-air-10-1,card-air-3-0,card-air-3-0,card-air-3-0,card-air-3-3}	2026-01-20 19:29:15.990819	2026-01-20 19:29:15.990819
3a8de1f7-5e15-451f-86e6-9d1fec103894	ai-test-1RW5y-	Test Deck 0xng	commander-fire	{card-fire-1-0,card-water-1-0,card-earth-1-0,card-air-1-0,card-fire-2-0,card-water-2-0,card-earth-2-0,card-air-2-0,card-fire-3-0,card-water-3-0,card-earth-3-0,card-air-3-0,card-fire-4-0,card-water-4-0,card-earth-4-0,card-air-4-0,card-fire-5-0,card-water-5-0,card-earth-5-0,card-air-5-0,card-fire-6-0,card-water-6-0,card-earth-6-0,card-air-6-0,card-fire-7-0,card-water-7-0,card-earth-7-0,card-air-7-0,card-fire-8-0,card-water-8-0,card-earth-8-0,card-air-8-0,card-fire-9-0,card-water-9-0,card-earth-9-0,card-air-9-0,card-fire-10-0,card-water-10-0,card-earth-10-0,card-air-10-0}	2026-01-23 01:34:57.521512	2026-01-23 01:34:57.521512
6a1ae56c-22ba-40d6-bc41-2faa845337e4	practice-fix-WAcBLc	Fix Test Deck N6of	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-23 01:39:49.207123	2026-01-23 01:39:49.207123
a40b29c8-e172-421f-99ff-db7e7b74eaa4	final-test-5PBFIL	e2e-test-deck-x4TnWn	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-23 01:43:48.340985	2026-01-23 01:43:48.340985
fa0467d2-423a-429a-aa8b-57b5c523ed0f	card-click-xwqxPP	e2e-test-deck-LSWy8D	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-23 01:52:15.226515	2026-01-23 01:52:15.226515
a0019b0d-81fe-4bd6-ad6e-db8123e57467	test-vw-CzfG1Y	Auto Test Deck rKFThB	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-23 19:05:37.250985	2026-01-23 19:05:37.250985
fa5319c6-60b7-40c1-980d-2cec83ccaf4f	manual-host-${nanoid(4)}	ManualDeck1	commander-fire	{card-air-1-0,card-air-1-1,card-air-1-2,card-air-1-3,card-air-2-0,card-air-2-1,card-air-2-2,card-air-2-3,card-air-3-0,card-air-3-1,card-air-3-2,card-air-3-3,card-air-4-0,card-air-4-1,card-air-4-2,card-air-4-3,card-air-5-0,card-air-5-1,card-air-5-2,card-air-5-3,card-air-6-0,card-air-6-1,card-air-6-2,card-air-6-3,card-air-7-0,card-air-7-1,card-air-7-2,card-air-7-3,card-air-8-0,card-air-8-1,card-air-8-2,card-air-8-3,card-air-9-0,card-air-9-1,card-air-9-2,card-air-9-3,card-air-10-0,card-air-10-1,card-air-10-2,card-air-10-3}	2026-01-28 18:31:10.92128	2026-01-28 18:31:10.92128
0d81f5b7-78ec-46a1-99be-4cd59fd8bdb6	manual-guest-wpwX	ManualDeck2	commander-fire	{card-air-1-0,card-air-1-1,card-air-1-2,card-air-1-3,card-air-2-0,card-air-2-1,card-air-2-2,card-air-2-3,card-air-3-0,card-air-3-1,card-air-3-2,card-air-3-3,card-air-4-0,card-air-4-1,card-air-4-2,card-air-4-3,card-air-5-0,card-air-5-1,card-air-5-2,card-air-5-3,card-air-6-0,card-air-6-1,card-air-6-2,card-air-6-3,card-air-7-0,card-air-7-1,card-air-7-2,card-air-7-3,card-air-8-0,card-air-8-1,card-air-8-2,card-air-8-3,card-air-9-0,card-air-9-1,card-air-9-2,card-air-9-3,card-air-10-0,card-air-10-1,card-air-10-2,card-air-10-3}	2026-01-28 18:36:37.848085	2026-01-28 18:36:37.848085
e60113df-ea2e-46f7-8a5e-ae05fd8dc974	testai-ve19Xr	Test Deck uQWg	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-24 01:49:50.239452	2026-01-24 01:49:50.239452
1a0534c4-e956-4961-877a-d47cad340c09	testflow-CpGoAC	TestFlow Fire Deck	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-24 01:53:17.388649	2026-01-24 01:53:17.388649
0140fa2d-80d4-4ab3-80cd-f9f1eb83bbd7	test-player-combat-crTWix	Auto Test Deck	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-24 20:00:07.536189	2026-01-24 20:00:07.536189
c934e0ad-7056-4fb8-a66c-23a874c1abac	test-combat-_NOGFV	AutoTest Deck nEnOtT	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-24 20:06:59.357357	2026-01-24 20:06:59.357357
0ed6ee2b-d2ff-4568-bf3a-55bb387ba016	combat-log-test-bRsWH9	Pyros's Elemental Pantheon	commander-fire	{card-fire-1-0,card-water-1-0,card-earth-1-0,card-air-1-0,card-fire-2-0,card-water-2-0,card-earth-2-0,card-air-2-0,card-fire-3-0,card-water-3-0,card-air-3-0,card-earth-3-0,card-fire-4-0,card-water-4-0,card-air-4-0,card-earth-4-0,card-fire-5-0,card-water-5-0,card-earth-5-0,card-air-5-0,card-fire-6-0,card-water-6-0,card-earth-6-0,card-air-6-0,card-fire-7-0,card-water-7-0,card-air-7-0,card-earth-7-0,card-fire-8-0,card-water-8-0,card-earth-8-0,card-air-8-0,card-fire-9-0,card-water-9-0,card-earth-9-0,card-air-9-0,card-fire-10-0,card-water-10-0,card-earth-10-0,card-air-10-0}	2026-01-24 20:45:34.336946	2026-01-24 20:45:34.336946
3333f8d0-4010-4b7f-bd37-b40d59600f9b	combatlog-test-8WRcg0	Eternal Flame's Embrace	commander-fire	{card-fire-1-0,card-fire-1-0,card-fire-1-0,card-water-1-0,card-fire-2-0,card-fire-2-0,card-fire-2-0,card-water-2-0,card-fire-3-0,card-fire-3-0,card-fire-3-0,card-earth-3-0,card-fire-4-0,card-fire-4-0,card-fire-4-0,card-air-4-0,card-fire-5-0,card-fire-5-0,card-fire-5-0,card-earth-5-0,card-fire-6-0,card-fire-6-0,card-fire-6-0,card-nature-6-0,card-fire-7-0,card-fire-7-0,card-fire-7-0,card-water-7-0,card-fire-8-0,card-fire-8-0,card-fire-8-0,card-water-8-0,card-fire-9-0,card-fire-9-0,card-fire-9-0,card-air-9-0,card-fire-10-0,card-fire-10-0,card-fire-10-0,card-water-10-0}	2026-01-25 15:18:37.71757	2026-01-25 15:18:37.71757
d43110bf-f02b-4049-b18a-d5833bfcd403	game-p1-sIqsYX	TestDeck-o_vY	commander-fire	{card-fire-1-0,card-fire-1-0,card-fire-1-0,card-water-1-0,card-fire-2-0,card-fire-2-0,card-fire-2-0,card-earth-2-0,card-fire-3-0,card-fire-3-0,card-fire-3-0,card-earth-3-0,card-fire-4-0,card-fire-4-0,card-earth-4-0,card-air-4-0,card-fire-5-0,card-fire-5-0,card-earth-5-0,card-air-5-0,card-fire-6-0,card-fire-6-0,card-nature-6-0,card-earth-6-0,card-fire-7-0,card-fire-7-0,card-earth-7-0,card-water-7-0,card-fire-8-0,card-fire-8-0,card-fire-8-0,card-water-8-0,card-fire-9-0,card-fire-9-0,card-air-9-0,card-earth-9-0,card-fire-10-0,card-fire-10-0,card-water-10-0,card-earth-10-0}	2026-01-28 18:10:24.152481	2026-01-28 18:10:24.152481
ff693b38-1f6c-4b3b-a913-fccf0148a486	game-p2-s_bYcR	P2Deck-LPgx	commander-fire	{card-fire-1-0,card-water-1-0,card-earth-1-0,card-air-1-0,card-fire-2-0,card-water-2-0,card-earth-2-0,card-air-2-0,card-fire-3-0,card-fire-3-0,card-water-3-0,card-earth-3-0,card-fire-4-0,card-fire-4-0,card-air-4-0,card-earth-4-0,card-fire-5-0,card-fire-5-0,card-earth-5-0,card-air-5-0,card-fire-6-0,card-fire-6-0,card-air-6-0,card-nature-6-0,card-fire-7-0,card-fire-7-0,card-water-7-0,card-earth-7-0,card-fire-8-0,card-fire-8-0,card-water-8-0,card-earth-8-0,card-fire-9-0,card-fire-9-0,card-earth-9-0,card-air-9-0,card-fire-10-0,card-fire-10-0,card-water-10-0,card-earth-10-0}	2026-01-28 18:13:52.70105	2026-01-28 18:13:52.70105
c09aebed-230f-42bb-b4c0-c27b572b5007	test-user-mp-p5q2Yd	Test MP Deck rtRN	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-28 18:59:02.55403	2026-01-28 18:59:02.55403
test-deck-for-mp	mp-test-seed-abc	Pre-Seeded Test Deck	commander-fire	{card-fire-1-0,card-fire-1-1,card-fire-1-2,card-fire-1-3,card-fire-2-0,card-fire-2-1,card-fire-2-2,card-fire-2-3,card-fire-3-0,card-fire-3-1,card-fire-3-2,card-fire-3-3,card-fire-4-0,card-fire-4-1,card-fire-4-2,card-fire-4-3,card-fire-5-0,card-fire-5-1,card-fire-5-2,card-fire-5-3,card-fire-6-0,card-fire-6-1,card-fire-6-2,card-fire-6-3,card-fire-7-0,card-fire-7-1,card-fire-7-2,card-fire-7-3,card-fire-8-0,card-fire-8-1,card-fire-8-2,card-fire-8-3,card-fire-9-0,card-fire-9-1,card-fire-9-2,card-fire-9-3,card-fire-10-0,card-fire-10-1,card-fire-10-2,card-fire-10-3}	2026-01-28 19:16:39.455227	2026-01-28 19:16:39.455227
\.


--
-- Data for Name: user_presence; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_presence (id, user_id, status, current_room_id, current_game_id, last_seen) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at) FROM stdin;
test-user-123	testuser@example.com	Test	User	\N	2026-01-15 03:04:39.052073	2026-01-15 03:04:39.052073
gip5Ey	gip5Ey@example.com	John	Doe	\N	2026-01-15 14:24:36.08741	2026-01-15 14:24:36.08741
test-user-ai-deck-123	testai@example.com	Test	User	\N	2026-01-15 18:58:53.746655	2026-01-15 18:58:53.746655
test-user-deck-123	decktest@example.com	Deck	Tester	\N	2026-01-15 19:35:42.571701	2026-01-15 19:35:42.571701
v6__aw	v6__aw@example.com	John	Doe	\N	2026-01-15 23:42:27.388226	2026-01-15 23:42:27.388226
IlMi0p	IlMi0p@example.com	John	Doe	\N	2026-01-20 05:34:26.122324	2026-01-20 05:34:26.122324
bhgxOt	bhgxOt@example.com	John	Doe	\N	2026-01-20 05:39:07.946386	2026-01-20 05:39:07.946386
unique-deck-test-123	unique-decktest-123@example.com	Deck	Tester	\N	2026-01-20 16:04:35.170988	2026-01-20 16:04:35.170988
practice-deck-test-456	practice-decktest-456@example.com	Practice	User	\N	2026-01-20 19:33:53.290401	2026-01-20 19:33:53.290401
test-user-BISmbK	testplayerUUeuWp@example.com	Test	Player	\N	2026-01-23 01:25:04.453657	2026-01-23 01:25:04.453657
test-practice-enmYch	testpracticeDtKNsQ@example.com	Practice	Tester	\N	2026-01-23 01:26:53.335798	2026-01-23 01:26:53.335798
ai-test-1RW5y-	aitestjtFx3S@example.com	AI	Tester	\N	2026-01-23 01:34:03.314837	2026-01-23 01:34:03.314837
practice-fix-WAcBLc	practicefixBCaiD5@example.com	Practice	Fixer	\N	2026-01-23 01:38:58.895945	2026-01-23 01:38:58.895945
final-test-5PBFIL	finaltestRTU_oT@example.com	Final	Test	\N	2026-01-23 01:43:40.235505	2026-01-23 01:43:40.235505
card-click-xwqxPP	cardclickSoeZYu@example.com	Card	Clicker	\N	2026-01-23 01:51:57.878293	2026-01-23 01:51:57.878293
test-vw-CzfG1Y	testvw-GFz8X@example.com	Test	User	\N	2026-01-23 19:05:14.326403	2026-01-23 19:05:14.326403
testsimple-as0uhb	testsimpleDn3Qee@example.com	Simple	User	\N	2026-01-23 19:10:25.264494	2026-01-23 19:10:25.264494
testai-ve19Xr	testaipyJhnt@example.com	Test	AI	\N	2026-01-24 01:49:39.492931	2026-01-24 01:49:39.492931
testflow-CpGoAC	testflow6vMmsL@example.com	Flow	Test	\N	2026-01-24 01:53:05.312343	2026-01-24 01:53:05.312343
test-player-combat-crTWix	playerO_jhO4@example.com	Combat	Tester	\N	2026-01-24 19:59:46.584895	2026-01-24 19:59:46.584895
test-combat-_NOGFV	combattestGwafFP@example.com	Combat	Test	\N	2026-01-24 20:06:37.033552	2026-01-24 20:06:37.033552
combat-log-test-bRsWH9	combatlogSnz-Ow@example.com	Combat	Tester	\N	2026-01-24 20:38:13.600919	2026-01-24 20:38:13.600919
combat-persist-9lbhND	combatpersistkHGX2A@example.com	Persist	Test	\N	2026-01-24 20:51:07.126016	2026-01-24 20:51:07.126016
combatlogtest-U24oQ8	combatlogKjSxFw@example.com	Combat	LogTest	\N	2026-01-24 21:00:10.50602	2026-01-24 21:00:10.50602
test-user-combat-log	testcombat@example.com	Test	User	\N	2026-01-25 15:15:55.636424	2026-01-25 15:15:55.636424
combatlog-test-8WRcg0	combattestKInI54@example.com	Combat	Tester	\N	2026-01-25 15:17:07.736301	2026-01-25 15:17:07.736301
50128681	redeagle28089@gmail.com	Jason	William Myers	\N	2026-01-15 03:06:51.846136	2026-01-28 03:58:27.762
test-player-1	player1@test.com	Test	Player1	\N	2026-01-28 17:50:26.052197	2026-01-28 17:50:26.052197
mp-player-1-Ox2bYq	mpplayer1-bV2syZ@test.com	Player	One	\N	2026-01-28 17:58:59.661108	2026-01-28 17:58:59.661108
mp-player-2-biq3Sx	mpplayer2-rpAU5G@test.com	Player	Two	\N	2026-01-28 18:00:40.103144	2026-01-28 18:00:40.103144
game-p1-sIqsYX	gamep1-z5mobm@test.com	Alice	Host	\N	2026-01-28 18:08:26.714301	2026-01-28 18:08:26.714301
game-p2-s_bYcR	gamep2-dwGqRX@test.com	Bob	Guest	\N	2026-01-28 18:11:58.443653	2026-01-28 18:11:58.443653
spectator-OJaXfB	spectator-gMqjCX@test.com	Charlie	Watcher	\N	2026-01-28 18:17:48.428783	2026-01-28 18:17:48.428783
host-${nanoid(4)}	host${nanoid(4)}@test.com	Host	Player	\N	2026-01-28 18:20:22.631219	2026-01-28 18:20:22.631219
manual-host-${nanoid(4)}	manualhost${nanoid(4)}@test.com	Manual	Host	\N	2026-01-28 18:23:26.128293	2026-01-28 18:23:26.128293
manual-guest-wpwX	manualguestABbA@test.com	Manual	Guest	\N	2026-01-28 18:34:11.520782	2026-01-28 18:34:11.520782
test-user-mp-p5q2Yd	mptestXvs2E0@example.com	Multiplayer	Tester	\N	2026-01-28 18:56:23.906932	2026-01-28 18:56:23.906932
test-deck-mWlqHU	decktest5kSlb8@example.com	Deck	Test	\N	2026-01-28 19:02:19.347287	2026-01-28 19:02:19.347287
mp-test-seed-abc	mpseeded@example.com	Seeded	User	\N	2026-01-28 19:15:59.599741	2026-01-28 19:16:18.587
\.


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: daily_challenges daily_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_challenges
    ADD CONSTRAINT daily_challenges_pkey PRIMARY KEY (id);


--
-- Name: deck_codes deck_codes_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_codes
    ADD CONSTRAINT deck_codes_code_unique UNIQUE (code);


--
-- Name: deck_codes deck_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_codes
    ADD CONSTRAINT deck_codes_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: game_rooms game_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_pkey PRIMARY KEY (id);


--
-- Name: matchmaking_queue matchmaking_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_pkey PRIMARY KEY (id);


--
-- Name: matchmaking_queue matchmaking_queue_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_user_id_unique UNIQUE (user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: player_achievements player_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_pkey PRIMARY KEY (id);


--
-- Name: player_challenges player_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_pkey PRIMARY KEY (id);


--
-- Name: player_ratings player_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_ratings
    ADD CONSTRAINT player_ratings_pkey PRIMARY KEY (id);


--
-- Name: player_ratings player_ratings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_ratings
    ADD CONSTRAINT player_ratings_user_id_unique UNIQUE (user_id);


--
-- Name: player_stats player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_pkey PRIMARY KEY (id);


--
-- Name: player_stats player_stats_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_user_id_unique UNIQUE (user_id);


--
-- Name: room_spectators room_spectators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_spectators
    ADD CONSTRAINT room_spectators_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: user_decks user_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_decks
    ADD CONSTRAINT user_decks_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_unique UNIQUE (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- Name: idx_chat_messages_game; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_game ON public.chat_messages USING btree (game_id);


--
-- Name: idx_chat_messages_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_room ON public.chat_messages USING btree (room_id);


--
-- Name: idx_daily_challenges_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_challenges_date ON public.daily_challenges USING btree (active_date);


--
-- Name: idx_deck_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deck_codes_code ON public.deck_codes USING btree (code);


--
-- Name: idx_deck_codes_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deck_codes_creator ON public.deck_codes USING btree (creator_id);


--
-- Name: idx_friend_requests_receiver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id);


--
-- Name: idx_friend_requests_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friend_requests_sender ON public.friend_requests USING btree (sender_id);


--
-- Name: idx_friendships_friend; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friendships_friend ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friendships_user ON public.friendships USING btree (user_id);


--
-- Name: idx_game_rooms_host; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_rooms_host ON public.game_rooms USING btree (host_id);


--
-- Name: idx_game_rooms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_rooms_status ON public.game_rooms USING btree (status);


--
-- Name: idx_matchmaking_queue_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matchmaking_queue_rating ON public.matchmaking_queue USING btree (rating);


--
-- Name: idx_matchmaking_queue_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matchmaking_queue_type ON public.matchmaking_queue USING btree (queue_type);


--
-- Name: idx_player_achievements_achievement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_achievements_achievement ON public.player_achievements USING btree (achievement_id);


--
-- Name: idx_player_achievements_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_achievements_user ON public.player_achievements USING btree (user_id);


--
-- Name: idx_player_challenges_challenge; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_challenges_challenge ON public.player_challenges USING btree (challenge_id);


--
-- Name: idx_player_challenges_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_challenges_user ON public.player_challenges USING btree (user_id);


--
-- Name: idx_player_ratings_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ratings_rating ON public.player_ratings USING btree (rating);


--
-- Name: idx_player_ratings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ratings_user ON public.player_ratings USING btree (user_id);


--
-- Name: idx_player_stats_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_stats_level ON public.player_stats USING btree (level);


--
-- Name: idx_player_stats_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_stats_user ON public.player_stats USING btree (user_id);


--
-- Name: idx_player_stats_xp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_stats_xp ON public.player_stats USING btree (total_xp);


--
-- Name: idx_room_spectators_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_room_spectators_room ON public.room_spectators USING btree (room_id);


--
-- Name: idx_user_presence_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_presence_status ON public.user_presence USING btree (status);


--
-- Name: idx_user_presence_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_presence_user ON public.user_presence USING btree (user_id);


--
-- Name: chat_messages chat_messages_room_id_game_rooms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_game_rooms_id_fk FOREIGN KEY (room_id) REFERENCES public.game_rooms(id);


--
-- Name: chat_messages chat_messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: deck_codes deck_codes_creator_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deck_codes
    ADD CONSTRAINT deck_codes_creator_id_users_id_fk FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: friend_requests friend_requests_receiver_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: friend_requests friend_requests_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: friendships friendships_friend_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_friend_id_users_id_fk FOREIGN KEY (friend_id) REFERENCES public.users(id);


--
-- Name: friendships friendships_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: game_rooms game_rooms_guest_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_guest_id_users_id_fk FOREIGN KEY (guest_id) REFERENCES public.users(id);


--
-- Name: game_rooms game_rooms_host_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_host_id_users_id_fk FOREIGN KEY (host_id) REFERENCES public.users(id);


--
-- Name: matchmaking_queue matchmaking_queue_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: player_achievements player_achievements_achievement_id_achievements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_achievement_id_achievements_id_fk FOREIGN KEY (achievement_id) REFERENCES public.achievements(id);


--
-- Name: player_achievements player_achievements_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_challenges player_challenges_challenge_id_daily_challenges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_challenge_id_daily_challenges_id_fk FOREIGN KEY (challenge_id) REFERENCES public.daily_challenges(id);


--
-- Name: player_challenges player_challenges_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_challenges
    ADD CONSTRAINT player_challenges_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_ratings player_ratings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_ratings
    ADD CONSTRAINT player_ratings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_stats player_stats_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: room_spectators room_spectators_room_id_game_rooms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_spectators
    ADD CONSTRAINT room_spectators_room_id_game_rooms_id_fk FOREIGN KEY (room_id) REFERENCES public.game_rooms(id);


--
-- Name: room_spectators room_spectators_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_spectators
    ADD CONSTRAINT room_spectators_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_decks user_decks_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_decks
    ADD CONSTRAINT user_decks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_presence user_presence_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nSN65W1QA1YC7pa5dMS2PYA4CJ1H7EzTKcNWbbeqnqSpp8daqrCZsDU4HpY3QYn

