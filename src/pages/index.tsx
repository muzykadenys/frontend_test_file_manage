import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/DashboardPage"), {
  ssr: false,
  loading: () => (
    <div className="layout">
      <p className="muted">Loading…</p>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}
