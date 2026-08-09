import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarPlus, Home } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen flex-col bg-background"
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Clinic Bookings"
              width={34}
              height={34}
              className="rounded-[10px]"
            />
            <span className="text-[15px] font-bold tracking-tight">
              Clinic Bookings
            </span>
          </Link>
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/auth">Se connecter</Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <p className="text-7xl font-extrabold tracking-tight text-primary/20 sm:text-8xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Cette page n'existe pas
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            Le lien que vous avez suivi est introuvable ou a été déplacé.
            Revenez à l'accueil ou reprenez votre réservation en ligne.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/">
                <Home className="size-4" />
                Retour à l'accueil
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-7"
            >
              <Link to="/auth?returnTo=/dashboard">
                <CalendarPlus className="size-4" />
                Prendre rendez-vous
              </Link>
            </Button>
          </div>
          <Button
            asChild
            variant="ghost"
            className="mt-6 gap-1.5 rounded-full text-muted-foreground"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Aller à mon espace
            </Link>
          </Button>
        </motion.div>
      </main>
    </motion.div>
  );
}
