import ChatLayout from "../components/ChatLayout";

import { useAuth } from "../context/AuthContext";

export default function Chat() {
  const { logout } = useAuth();

  return <ChatLayout onLogout={logout} />;
}
