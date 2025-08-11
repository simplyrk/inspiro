# Quotes App

A modern, full-stack quotes application built with Next.js 15, TypeScript, Prisma, and PostgreSQL. Users can view, manage, and favorite inspirational quotes with a beautiful, responsive interface.

## Features

- **User Authentication**: Secure signup/login system with NextAuth.js
- **Quote Management**: Browse preloaded quotes or create custom quotes
- **Favorites System**: Save your favorite quotes for quick access
- **User Preferences**: Customize your experience with themes, font sizes, and rotation intervals
- **Dark/Light Mode**: System-aware theme switching
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Built with React Query for optimal data fetching

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **State Management**: React Query (TanStack Query)
- **Animations**: Framer Motion
- **Deployment Ready**: Optimized for Vercel/Neon deployment

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL database (local or cloud service like Neon)
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd quotes-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file and update with your values:
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database credentials and NextAuth configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   ```
   
   Generate a secure secret for NextAuth:
   ```bash
   openssl rand -base64 32
   ```

4. **Set up the database**
   
   Run Prisma migrations to create the database schema:
   ```bash
   npm run prisma:push
   ```
   
   Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
   
   (Optional) Seed the database with sample quotes:
   ```bash
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema changes to database
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run seed` - Seed database with sample quotes from quotes.csv

## Project Structure

```
quotes-app/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── favorites/    # Favorites management
│   │   ├── preferences/  # User preferences
│   │   └── quotes/       # Quote CRUD operations
│   ├── auth/             # Authentication pages
│   └── quotes/           # Quotes display page
├── components/            # React components
│   ├── providers/        # Context providers
│   └── ui/              # UI components
├── lib/                  # Utility functions and configurations
├── prisma/              # Database schema and migrations
│   ├── schema.prisma    # Prisma schema definition
│   └── seed.ts         # Database seeding script
├── public/              # Static assets
└── quotes.csv          # Sample quotes data
```

## Database Schema

The application uses the following main models:

- **User**: User accounts with authentication
- **Quote**: Both preloaded and user-created quotes
- **Favorite**: User's favorite quotes
- **UserPreferences**: Customizable user settings
- **Account/Session**: NextAuth authentication models

## API Endpoints

- `POST /api/auth/signup` - User registration
- `GET /api/quotes` - Fetch quotes (with pagination and filtering)
- `POST /api/quotes` - Create custom quote
- `GET /api/favorites` - Get user's favorites
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/:id` - Remove from favorites
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preferences

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Database Setup (Neon)

1. Create a Neon account and new project
2. Copy the connection strings
3. Update environment variables
4. Run migrations: `npm run prisma:push`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue in the GitHub repository.