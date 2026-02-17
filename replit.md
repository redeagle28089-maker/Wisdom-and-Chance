# Wisdom & Chance TCG

## Overview
Wisdom & Chance TCG is a tactical trading card game simulator designed to provide a rich and engaging experience for players. It features deck building, practice battles against AI, and real-time multiplayer functionality. The project's vision is to create a fully immersive card game universe where players can master elemental powers, craft strategic decks, and compete in a dynamic online environment. Key capabilities include Google authentication, a robust multiplayer system with friends and rooms, and a comprehensive card database.

## User Preferences
I prefer clear and concise communication. For coding, I favor functional programming paradigms where applicable and maintainable. When developing, I appreciate an iterative approach with frequent, small commits. Please ask before making any major architectural changes or decisions that might significantly alter the project's direction.

## System Architecture

### UI/UX Decisions
The game features a dark fantasy themed UI, utilizing element-specific color schemes. Shadcn UI components provide a consistent and modern aesthetic. The design includes various card sizes (standard, 'xl' for databases/deck builders, and larger for commanders) to optimize visual information. The application is designed as a Progressive Web App (PWA) for installability and mobile accessibility, including responsive app icons.

### Technical Implementations
The application is built with a React 18 frontend, leveraging Tailwind CSS for styling and Wouter for routing. State management and data fetching are handled by TanStack Query. The backend is an Express.js server written in TypeScript. Real-time communication for multiplayer functionality is managed via WebSockets. Authentication is handled through Replit Auth, supporting Google/GitHub/email logins via OIDC, with user data and sessions persisted in a PostgreSQL database. JWT-based authentication is implemented for mobile API readiness, including refresh token mechanisms.

Key features include:
- **Deck Builder:** Allows users to create and manage decks with validation rules (40 cards, specific power distribution, max 3 copies of any card). Decks are saved to the user's account in PostgreSQL.
- **AI Deck Suggestion System:** Integrates the Gemini 2.5 Flash model to provide AI-generated deck recommendations based on selected commander and playstyle (Aggressive/Defensive/Balanced).
- **Multiplayer System:** Supports a game lobby, room creation (public/private), pre-game waiting areas with deck selection, and a ready system. Real-time game synchronization, in-game chat, and spectator mode are all powered by WebSockets. A friend system allows users to send requests, track online status, and manage connections.
- **Practice Mode:** Users can play against an AI opponent with adjustable difficulty levels (Easy, Medium, Hard).
- **Admin Tools:** An admin-only interface allows for AI-powered card art generation using the Gemini 2.5 Flash Image model. This includes generating art only, stats only, or complete cards, with options for reference image uploads and toggling stat generation. An image database allows for browsing, managing, and applying artwork to cards.
- **Engagement Systems:** Includes achievements, daily challenges with XP rewards, a global leaderboard with ELO rating tiers, and in-game emotes.
- **Game Mechanics:** Implements a turn-based battle system with five distinct phases (Draw, Deployment, Combat, Calculation, End) and specific victory conditions.
- **Data Storage:** While game data is primarily handled in-memory using a `MemStorage` class during active gameplay, user-specific data like saved decks, friends, and user profiles are persistently stored in a PostgreSQL database.

### System Design Choices
- **API Structure:** A clear separation of concerns is maintained with dedicated API endpoints for authentication, game data, user-specific decks, friend management, room management, and admin functions.
- **WebSocket Security:** WebSocket connections are secured using session-based authentication, validating cookies upon connection. Authorization checks are implemented for joining rooms and games to ensure only authorized users can participate or spectate.
- **Error Handling:** OIDC authentication is manually implemented using `fetch` to mitigate bundling issues, ensuring robust JWT signature and claim validation.
- **PWA Capabilities:** Manifest and service worker are configured for offline capabilities and an installable experience.

## External Dependencies

- **PostgreSQL:** Primary database for persistent user data, saved decks, friend lists, and game statistics.
- **Replit Auth:** Used for user authentication, providing seamless integration with Google, GitHub, and email login providers via OIDC.
- **Google Gemini 2.5 Flash Model:** Utilized for AI deck suggestions and AI-powered card art generation in admin tools.
- **React 18:** Frontend framework.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **Shadcn UI:** Reusable UI components.
- **Wouter:** Lightweight React router.
- **TanStack Query:** For data fetching and state management.
- **Express.js:** Backend web framework.
- **TypeScript:** Programming language for both frontend and backend.
- **MemStorage:** In-memory storage solution used for active game state during a session.