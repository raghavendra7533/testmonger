import { Toaster } from 'react-hot-toast';
import AppShell from './components/layout/AppShell';

export default function App() {
  return (
    <>
      <AppShell />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1A1A1D',
            color: '#EDEDEF',
            border: '1px solid #2A2A2E',
            fontSize: '13px',
          },
        }}
      />
    </>
  );
}
