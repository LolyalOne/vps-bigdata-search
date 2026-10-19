import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const checkTimeout = () => {
      const lastActive = localStorage.getItem("lastActiveTime");
      if (lastActive && Date.now() - parseInt(lastActive, 10) > TIMEOUT_MS) {
        if (auth.currentUser) {
          fbSignOut(auth);
          localStorage.removeItem("lastActiveTime");
        }
      }
    };

    const handleActivity = () => {
      if (!auth.currentUser) return;
      localStorage.setItem("lastActiveTime", Date.now().toString());
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fbSignOut(auth);
        localStorage.removeItem("lastActiveTime");
      }, TIMEOUT_MS);
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        handleActivity();
        window.addEventListener("mousemove", handleActivity);
        window.addEventListener("keydown", handleActivity);
        window.addEventListener("click", handleActivity);
        window.addEventListener("scroll", handleActivity);
        window.addEventListener("touchstart", handleActivity);
      } else {
        localStorage.removeItem("lastActiveTime");
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("keydown", handleActivity);
        window.removeEventListener("click", handleActivity);
        window.removeEventListener("scroll", handleActivity);
        window.removeEventListener("touchstart", handleActivity);
      }
    });

    const interval = setInterval(checkTimeout, 60000); // check every minute

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, []);

  const logout = async () => {
    localStorage.removeItem("lastActiveTime");
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
