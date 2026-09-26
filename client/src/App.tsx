import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import { useAuth } from "./context/AuthContext";

import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading Tong...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? "/chat" : "/login"} replace />}
      />

      <Route
        path="/login"
        element={user ? <Navigate to="/chat" replace /> : <Login />}
      />

      <Route
        path="/register"
        element={user ? <Navigate to="/chat" replace /> : <Register />}
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/chat" element={<Chat />} />

        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
