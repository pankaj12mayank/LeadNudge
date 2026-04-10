import LogoutConfirmModal from "./LogoutConfirmModal";
import { useAuthContext } from "../context/AuthContext";

export default function AuthLogoutLayer() {
  const {
    logoutModalOpen,
    cancelLogout,
    confirmLogout,
  } = useAuthContext();

  return (
    <LogoutConfirmModal
      open={logoutModalOpen}
      onStay={cancelLogout}
      onLogout={confirmLogout}
    />
  );
}
