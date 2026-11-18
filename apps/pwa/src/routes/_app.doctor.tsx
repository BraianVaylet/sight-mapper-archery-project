import { createFileRoute } from '@tanstack/react-router';
import { DoctorToleranceScreen } from '../features/doctor/doctor-tolerance-screen.js';

/** The Doctor of the menu: how it decides and the archer's tolerance (RF-CAL-09). */
export const Route = createFileRoute('/_app/doctor')({
  component: function DoctorToleranceRoute() {
    return <DoctorToleranceScreen />;
  },
});
