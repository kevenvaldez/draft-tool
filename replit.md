# Dynasty Draft Assistant

## Overview

A full-stack fantasy football dynasty draft assistant that integrates with Sleeper fantasy leagues and provides real-time player valuations through KeepTradeCut (KTC) data. The application helps users make informed draft decisions by providing up-to-date player rankings, values, and draft recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**July 20, 2025:**
- ✓ Successfully migrated project from Replit Agent to Replit environment
- ✓ Fixed critical KTC data parsing issue that was causing player name/value mismatches
- ✓ Improved player value matching logic to prevent incorrect score assignments
- ✓ Added KTC refresh endpoint for manual cache clearing
- ✓ Enhanced name parsing to properly separate player names, teams, and positions
- ✓ Verified all core functionality working correctly

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server concerns:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: PostgreSQL on Replit
- **Storage**: Database-backed persistence for all data including sessions
- **Session Management**: PostgreSQL-based persistent session storage
- **External APIs**: Integration with Sleeper API and KeepTradeCut scraping

### Project Structure
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Shared TypeScript schemas and types
- `migrations/` - Database migration files

## Key Components

### Data Layer
- **Database Schema**: Comprehensive schema covering leagues, drafts, players, draft picks, mock drafts, and watchlists
- **Player Management**: Central player repository with KTC value integration
- **Draft Tracking**: Real-time draft pick monitoring and state management

### API Layer
- **Sleeper Integration**: Connect to existing Sleeper leagues and drafts
- **KTC Data Service**: Web scraping service for real-time player valuations
- **Storage Interface**: Abstracted storage layer with in-memory and database implementations

### Frontend Components
- **Connection Panel**: Interface for linking Sleeper league/draft data
- **Draft Board**: Main interface displaying available players with filtering and search
- **Player Cards**: Individual player display with KTC values and draft status
- **Player Modal**: Detailed player information and watchlist management
- **Mock Draft Mode**: Simulated draft environment for practice

### External Integrations
- **Sleeper API**: Fetches league, draft, and player data
- **KeepTradeCut**: Scrapes current player values and rankings
- **Real-time Updates**: Periodic data refreshing for current information

## Data Flow

1. **Connection Phase**: User provides Sleeper league ID, draft ID, and user ID
2. **Validation**: System validates connection and fetches initial data
3. **Data Sync**: Player data synchronized with KTC values
4. **Real-time Updates**: Continuous polling for draft pick updates and value changes
5. **User Interaction**: Filtering, searching, and mock drafting capabilities
6. **Watchlist Management**: Personal player tracking and notes

## External Dependencies

### Backend Dependencies
- `@neondatabase/serverless` - Neon PostgreSQL client
- `drizzle-orm` - Type-safe ORM for database operations
- `axios` - HTTP client for external API calls
- `cheerio` - HTML parsing for web scraping
- `connect-pg-simple` - PostgreSQL session store

### Frontend Dependencies
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Comprehensive UI component library
- `wouter` - Lightweight routing
- `react-hook-form` - Form state management
- `zod` - Runtime type validation

### Development Tools
- `vite` - Build tool and development server
- `typescript` - Type safety and development experience
- `tailwindcss` - Utility-first CSS framework
- `drizzle-kit` - Database migration and schema management

## Deployment Strategy

### Build Process
- Frontend builds to `dist/public` via Vite
- Backend bundles with esbuild to `dist/index.js`
- Single production command serves static files and API

### Environment Requirements
- `DATABASE_URL` - PostgreSQL connection string (required)
- Node.js environment with ES modules support

### Database Management
- Drizzle migrations handle schema changes
- Push command for development schema updates
- PostgreSQL-compatible hosting (Neon recommended)

### Production Considerations
- Express serves static frontend files in production
- API routes prefixed with `/api`
- Error handling and request logging middleware
- CORS and security headers implementation needed for production