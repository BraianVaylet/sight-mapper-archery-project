import { createFileRoute } from '@tanstack/react-router';
import { ForgotScreen } from '../features/auth/forgot-screen.js';

export const Route = createFileRoute('/_guest/forgot-password')({ component: ForgotScreen });
