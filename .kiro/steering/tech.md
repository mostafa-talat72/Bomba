# Technology Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3 with custom RTL support
- **Routing**: React Router DOM 6
- **UI Components**: Ant Design 5 + Lucide React icons
- **State Management**: React Context API (AppContext, ThemeContext)
- **HTTP Client**: Axios with custom API wrapper
- **Real-time**: Socket.IO client
- **Charts**: Recharts
- **PDF Generation**: jsPDF with jspdf-autotable
- **Date Handling**: date-fns, dayjs
- **Notifications**: react-toastify

## Backend
- **Runtime**: Node.js 18+ (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO
- **Security**: Helmet, bcryptjs, CORS, express-rate-limit
- **Validation**: express-validator
- **Scheduling**: node-cron
- **File Upload**: Multer
- **QR Codes**: qrcode
- **Email**: Nodemailer
- **Logging**: Custom logger middleware

## Development Tools
- **Linting**: ESLint 9
- **Testing**: Vitest (frontend), Jest (backend)
- **Process Management**: PM2 (ecosystem.config.js)
- **Concurrency**: concurrently for dev mode

## Common Commands

### Development
```bash
npm run dev              # Run both frontend and backend
npm run client:dev       # Frontend only (port 3000)
npm run server:dev       # Backend only (port 5000)
```

### Building
```bash
npm run build            # Build frontend
npm run build:all        # Build both frontend and backend
```

### Testing
```bash
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
```

### Database
```bash
npm run seed:admin       # Create default admin user
```

### Installation
```bash
npm run install:all      # Install all dependencies (frontend + backend)
npm run install:server   # Install backend dependencies only
```

## Environment Configuration

### Frontend (.env)
- `VITE_API_URL`: Backend API URL (default: http://localhost:5000)

### Backend (server/.env)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_URL`: Frontend URL for CORS

## API Architecture
- RESTful API with `/api` prefix
- Proxy configured in Vite for development
- JWT authentication with Bearer tokens
- Automatic token refresh on 401 responses
- Socket.IO for real-time updates
