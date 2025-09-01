import LogoutButton from "@/components/auth/LogoutButton";

export default function AppHeader() {
  return (
    <header className="flex items-center gap-3 p-3 border-b">
      <h1 className="text-lg font-semibold">Pathfinder</h1>
      <div className="ml-auto">
        <LogoutButton className="px-3 py-1 rounded border" />
      </div>
    </header>
  );
}
