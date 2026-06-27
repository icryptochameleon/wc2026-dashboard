import { Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { TabBar } from './components/layout/TabBar';
import { Footer } from './components/layout/Footer';
import DashboardPage from './pages/DashboardPage';
import PlayerPage from './pages/PlayerPage';
import TournamentPage from './pages/TournamentPage';
import StatsPage from './pages/StatsPage';
import SimulationPage from './pages/SimulationPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabBar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 pb-24 sm:pb-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/players" element={<PlayerPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
