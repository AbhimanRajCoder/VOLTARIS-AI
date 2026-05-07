import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Docs from './pages/Docs';
import GettingStarted from './pages/GettingStarted';
import AdvancedUsage from './pages/AdvancedUsage';
import Playground from './pages/Playground';
import Demo from './pages/Demo';
import APIKeys from './pages/APIKeys';


const App = () => {
  const [apiKey, setApiKey] = useState('');

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Docs />} />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/advanced" element={<AdvancedUsage />} />
          <Route path="/keys" element={<APIKeys />} />

          <Route path="/demo" element={<Demo />} />
          <Route path="/playground" element={<Playground apiKey={apiKey} setApiKey={setApiKey} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
