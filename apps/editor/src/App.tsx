import { CloudOff, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { AuthScreen } from "./features/auth/AuthScreen";
import { EditorPage } from "./features/editor/EditorPage";
import { ProjectsPage } from "./features/home/ProjectsPage";
import { VideosPage } from "./features/home/VideosPage";
import { useRoute } from "./lib/router";
import { useAuth } from "./store/authStore";

/** Connexion obligatoire, puis : mes projets (/), mes vidéos (/videos), éditeur (/p/:id). */
export function App() {
  const auth = useAuth((s) => s.state);
  const check = useAuth((s) => s.check);
  const route = useRoute();

  useEffect(() => {
    void check();
  }, [check]);

  if (auth.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }
  if (auth.status === "offline") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
        <CloudOff size={28} />
        <p>Serveur injoignable.</p>
        <button type="button" className="text-accent underline" onClick={() => void check()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (auth.status === "anonymous") return <AuthScreen />;

  // La clé force un remontage propre quand on change de projet ou d'utilisateur.
  switch (route.name) {
    case "editor":
      return <EditorPage key={`${auth.user.id}:${route.projectId}`} projectId={route.projectId} />;
    case "videos":
      return <VideosPage key={auth.user.id} />;
    default:
      return <ProjectsPage key={auth.user.id} />;
  }
}
