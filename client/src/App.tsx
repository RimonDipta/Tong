import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { Spinner } from "./components/ui/ConfirmDialog";
import { useAuth } from "./context/AuthContext";

import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex h-dvh items-center justify-center bg-[var(--bg)] text-zinc-500"
        role="status"
        aria-label="Loading Tong"
      >
        <Spinner size={22} />
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
        <Route path="/chat/:conversationId?" element={<Chat />} />

        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
