import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Hook that logs out the user after a period of inactivity.
 * - Patients: 5 minutes
 * - Staff: 10 minutes
 *
 * Shows a warning message before logout.
 */
export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getInactivityDuration = () => {
    // Staff gets 10 minutes, patients get 5 minutes
    return user?.role === "staff" ? 10 * 60 * 1000 : 5 * 60 * 1000;
  };

  const getWarningDuration = () => {
    // Show warning 1 minute before logout
    const total = getInactivityDuration();
    return total - 60 * 1000;
  };

  const resetInactivityTimer = () => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    const inactivityDuration = getInactivityDuration();
    const warningDuration = getWarningDuration();

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      const role = user?.role === "staff" ? "l'administration" : "votre session";
      toast.warning(
        `Inactivité détectée — ${role} sera fermée dans 1 minute.`,
        {
          duration: 60 * 1000,
        }
      );
    }, warningDuration);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      signOut();
      toast.info("Vous avez été déconnecté en raison de l'inactivité.");
    }, inactivityDuration);
  };

  useEffect(() => {
    if (!user) return;

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Initial timer
    resetInactivityTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [user, signOut]);
}
