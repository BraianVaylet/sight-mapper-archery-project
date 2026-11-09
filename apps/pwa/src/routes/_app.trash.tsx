import { createFileRoute } from '@tanstack/react-router';
import { TrashScreen } from '../features/setups/trash-screen.js';

export const Route = createFileRoute('/_app/trash')({ component: TrashScreen });
