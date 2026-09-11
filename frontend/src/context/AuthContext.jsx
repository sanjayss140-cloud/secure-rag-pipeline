import React, { createContext, useContext, useState, useEffect } from "react";
import { apiLogin, apiRegister, apiGetMe } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("securerag_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const profile = await apiGetMe();
          setUser(profile);
        } catch {
          localStorage.removeItem("securerag_token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, [token]);

  const login = async (username_or_email, password) => {
    const data = await apiLogin(username_or_email, password);
    localStorage.setItem("securerag_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const register = async (email, username, password) => {
    const data = await apiRegister(email, username, password);
    localStorage.setItem("securerag_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("securerag_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role?.toUpperCase() === "ADMIN",
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
