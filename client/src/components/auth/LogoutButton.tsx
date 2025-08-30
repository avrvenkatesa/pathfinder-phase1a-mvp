import { broadcastLogout } from "@/lib/authChannel";

type Props = { className?: string; label?: string };

export default function LogoutButton({ className, label = "Log out" }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        // notify other tabs, then hit the server to destroy the session
        try {
          broadcastLogout();
        } finally {
          window.location.href = "/api/logout";
        }
      }}
    >
      {label}
    </button>
  );
}
