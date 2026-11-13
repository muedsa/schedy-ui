import { useCallback, useEffect, useState } from "react";

export type Route = "tasks" | "system";

function readRoute(): Route {
  return window.location.hash.replace(/^#\/?/, "") === "system" ? "system" : "tasks";
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = `/${next}`;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return [route, navigate];
}
