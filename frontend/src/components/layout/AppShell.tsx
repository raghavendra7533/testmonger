import { useStore } from '../../store';
import Sidebar from './Sidebar';
import GenerateView from '../../views/GenerateView';
import ConfigView from '../../views/ConfigView';
import HistoryView from '../../views/HistoryView';

export default function AppShell() {
  const currentView = useStore((s) => s.currentView);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface-primary">
        {currentView === 'generate' && <GenerateView />}
        {currentView === 'config' && <ConfigView />}
        {currentView === 'history' && <HistoryView />}
      </main>
    </div>
  );
}
