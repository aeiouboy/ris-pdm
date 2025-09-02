import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import MobileBottomNav from './components/MobileBottomNav';
import Dashboard from './pages/Dashboard';
import IndividualPerformance from './pages/IndividualPerformance';
import Reports from './pages/Reports';

function App() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const closeMobileNav = () => {
    setIsMobileNavOpen(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile Navigation */}
        <MobileNav isOpen={isMobileNavOpen} onClose={closeMobileNav} />

        {/* Desktop Layout */}
        <div className="flex h-screen">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex md:w-64 md:flex-col">
            <Sidebar />
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <Header onMobileMenuToggle={toggleMobileNav} />

            {/* Page content */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-16 md:pb-0">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/individual" element={<IndividualPerformance />} />
                <Route path="/individual/:userId" element={<IndividualPerformance />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </main>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </Router>
  );
}

export default App;
